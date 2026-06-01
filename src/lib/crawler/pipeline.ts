// ---------------------------------------------------------------------------
// Full Auto-Evolution Pipeline — discover → evaluate → evolve
// ---------------------------------------------------------------------------
// Orchestrates the complete auto-crawling and self-evolution cycle.
// Uses in-memory lock to prevent concurrent pipeline runs.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { discoverImagesForFamily } from './discover';
import { evaluateImageInternal } from './evaluate-internal';
import { evolveFamilyInternal } from './evolve-internal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineStatus {
  isRunning: boolean;
  currentPhase:
    | 'idle'
    | 'discovering'
    | 'evaluating'
    | 'evolving'
    | 'complete'
    | 'error'
    | 'rate_limited';
  currentFamily: string | null;
  progress: { current: number; total: number };
  lastRunAt: Date | null;
  lastResult: PipelineResult | null;
  error: string | null;
  rateLimited: boolean;
}

export interface PipelineResult {
  taskId: string;
  itemsDiscovered: number;
  itemsEvaluated: number;
  itemsFailed: number;
  itemsSkipped: number;
  evolutionTriggered: boolean;
  rulesCreated: number;
  rulesDeprecated: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// In-memory pipeline state (singleton, persisted via globalThis)
// Next.js with Turbopack may create separate module instances for different
// API routes, so we use globalThis to ensure the state is shared.
// ---------------------------------------------------------------------------

const DEFAULT_STATE: PipelineStatus = {
  isRunning: false,
  currentPhase: 'idle',
  currentFamily: null,
  progress: { current: 0, total: 0 },
  lastRunAt: null,
  lastResult: null,
  error: null,
  rateLimited: false,
};

const globalForPipeline = globalThis as unknown as {
  __pipelineState: PipelineStatus | undefined;
};

const pipelineState: PipelineStatus =
  globalForPipeline.__pipelineState ?? { ...DEFAULT_STATE };

if (process.env.NODE_ENV !== 'production') {
  globalForPipeline.__pipelineState = pipelineState;
}

// ---------------------------------------------------------------------------
// Get current pipeline status
// ---------------------------------------------------------------------------

export function getPipelineStatus(): PipelineStatus {
  return { ...pipelineState };
}

// ---------------------------------------------------------------------------
// Rate-limiting helper
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Minimum delay between processing different families (ms)
// This prevents rapid-fire API calls across families that trigger 429 rate limits
const INTER_FAMILY_DELAY_MS = 10000; // 10 seconds between families (increased to avoid 429)

// Minimum delay between evaluations (ms)
const INTER_EVALUATION_DELAY_MS = 5000; // 5 seconds between evaluations (increased to avoid 429)

// ---------------------------------------------------------------------------
// Fetch image from URL and convert to base64
// ---------------------------------------------------------------------------

async function fetchImageAsBase64(
  imageUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Aesthetic-Self-Evolution/1.0',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) return null; // max 10MB

    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(
      `[pipeline] fetchImageAsBase64 error for ${imageUrl}:`,
      error
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// All family keys
// ---------------------------------------------------------------------------

const ALL_FAMILY_KEYS = [
  'narrative_visual',
  'interactive_ui',
  'spatial',
  'character',
  'graphic_composition',
  'dynamic_rhythm',
];

// ---------------------------------------------------------------------------
// Run the full pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(options: {
  familyKey?: string; // if null, run for all families
  sourceId?: string; // specific crawl source
  maxItemsPerFamily?: number; // default 5
  triggerEvolution?: boolean; // auto-trigger evolution after evaluation, default true
  language?: 'zh' | 'en'; // evaluation language
  trigger?: 'manual' | 'scheduled' | 'auto_evolve';
}): Promise<PipelineResult> {
  const {
    familyKey: familyKeyOpt,
    sourceId,
    maxItemsPerFamily = 5,
    triggerEvolution = true,
    language = 'en',
    trigger = 'manual',
  } = options;

  // ---- Check if pipeline is already running ----
  if (pipelineState.isRunning) {
    throw new Error('Pipeline is already running');
  }

  // ---- Lock the pipeline ----
  pipelineState.isRunning = true;
  pipelineState.currentPhase = 'discovering';
  pipelineState.currentFamily = null;
  pipelineState.progress = { current: 0, total: 0 };
  pipelineState.error = null;

  const startTime = Date.now();

  // ---- Determine families to process ----
  const familyKeys = familyKeyOpt
    ? [familyKeyOpt]
    : ALL_FAMILY_KEYS;

  // ---- Find or create a CrawlSource ----
  let crawlSourceId = sourceId;

  if (!crawlSourceId) {
    // Find or create a default source for the given family (or "all")
    const sourceName = familyKeyOpt
      ? `auto_${familyKeyOpt}`
      : 'auto_all_families';

    let source = await db.crawlSource.findFirst({
      where: { name: sourceName },
    });

    if (!source) {
      source = await db.crawlSource.create({
        data: {
          name: sourceName,
          type: 'search',
          familyKey: familyKeyOpt || null,
          status: 'active',
          maxItems: maxItemsPerFamily,
        },
      });
    }

    crawlSourceId = source.id;
  }

  // ---- Create CrawlTask record ----
  const crawlTask = await db.crawlTask.create({
    data: {
      sourceId: crawlSourceId,
      status: 'running',
      startedAt: new Date(),
      trigger,
    },
  });

  // ---- Result accumulator ----
  const result: PipelineResult = {
    taskId: crawlTask.id,
    itemsDiscovered: 0,
    itemsEvaluated: 0,
    itemsFailed: 0,
    itemsSkipped: 0,
    evolutionTriggered: false,
    rulesCreated: 0,
    rulesDeprecated: 0,
    duration: 0,
  };

  try {
    // ======================================================================
    // PHASE 1: DISCOVERY
    // ======================================================================
    pipelineState.currentPhase = 'discovering';
    pipelineState.rateLimited = false;
    pipelineState.progress = { current: 0, total: familyKeys.length };

    // Track if discovery is being rate-limited
    let discoveryRateLimited = false;

    for (const fk of familyKeys) {
      pipelineState.currentFamily = fk;

      // If all previous families were rate-limited, stop trying to avoid wasting API calls
      if (discoveryRateLimited) {
        console.warn(`[pipeline] Skipping family ${fk} due to rate limiting`);
        pipelineState.progress.current++;
        continue;
      }

      // Add delay between families to prevent 429 rate limiting
      if (pipelineState.progress.current > 0) {
        console.log(`[pipeline] Waiting ${INTER_FAMILY_DELAY_MS / 1000}s before processing family ${fk}...`);
        await delay(INTER_FAMILY_DELAY_MS);
      }

      try {
        const discoveredItems = await discoverImagesForFamily(
          fk,
          undefined,
          maxItemsPerFamily
        );

        // If discovery returned 0 items and we're getting 429s, mark as rate-limited
        if (discoveredItems.length === 0) {
          console.warn(`[pipeline] Family ${fk}: 0 items discovered, may be rate-limited`);
          // Check if this might be rate limiting by seeing if the family had results before
          const previousItems = await db.crawledItem.count({
            where: { familyKey: fk },
          });
          if (previousItems === 0) {
            // No items at all - could be rate limiting
            discoveryRateLimited = true;
            pipelineState.rateLimited = true;
          }
        }

        for (const item of discoveredItems) {
          try {
            // Check if imageUrl already exists in CrawledItem (dedup)
            const existing = await db.crawledItem.findFirst({
              where: { imageUrl: item.imageUrl },
            });

            if (existing) {
              result.itemsSkipped++;
              continue;
            }

            // Create CrawledItem record with status "pending"
            await db.crawledItem.create({
              data: {
                sourceId: crawlSourceId,
                taskId: crawlTask.id,
                imageUrl: item.imageUrl,
                title: item.title,
                sourceUrl: item.sourceUrl,
                description: item.description,
                familyKey: item.familyKey,
                evaluationStatus: 'pending',
              },
            });

            result.itemsDiscovered++;
          } catch (itemError) {
            console.error(
              `[pipeline] Error creating CrawledItem for ${item.imageUrl}:`,
              itemError
            );
            result.itemsSkipped++;
          }
        }

        // Update task itemsFound
        await db.crawlTask.update({
          where: { id: crawlTask.id },
          data: { itemsFound: result.itemsDiscovered },
        });
      } catch (discoverError) {
        console.error(
          `[pipeline] Discovery error for family ${fk}:`,
          discoverError
        );
      }

      pipelineState.progress.current++;
    }

    // ======================================================================
    // PHASE 2: EVALUATION
    // ======================================================================
    pipelineState.currentPhase = 'evaluating';
    pipelineState.currentFamily = null;

    // Get all pending CrawledItems for this task
    const pendingItems = await db.crawledItem.findMany({
      where: {
        taskId: crawlTask.id,
        evaluationStatus: 'pending',
      },
    });

    pipelineState.progress = { current: 0, total: pendingItems.length };

    for (const item of pendingItems) {
      pipelineState.currentFamily = item.familyKey || null;

      try {
        // Update status to "evaluating"
        await db.crawledItem.update({
          where: { id: item.id },
          data: { evaluationStatus: 'evaluating' },
        });

        // Fetch the image from URL and convert to base64
        const imageBase64 = await fetchImageAsBase64(item.imageUrl);

        if (!imageBase64) {
          await db.crawledItem.update({
            where: { id: item.id },
            data: {
              evaluationStatus: 'failed',
            },
          });
          result.itemsFailed++;
          pipelineState.progress.current++;
          continue;
        }

        // Evaluate using the internal evaluation function
        // Pass reclassify=true to let VLM verify/correct the familyKey
        const evalResult = await evaluateImageInternal({
          imageBase64,
          familyKey: item.familyKey || undefined,
          language,
          reclassify: true,
        });

        if (evalResult.error) {
          await db.crawledItem.update({
            where: { id: item.id },
            data: {
              evaluationStatus: 'failed',
            },
          });
          result.itemsFailed++;
        } else {
          // Update CrawledItem with evaluation results
          // If reclassified, the familyKey and familyId will reflect the VLM's correction
          await db.crawledItem.update({
            where: { id: item.id },
            data: {
              evaluationStatus: 'evaluated',
              evaluationId: evalResult.evaluationId,
              overallScore: evalResult.overallScore,
              familyKey: evalResult.familyKey,
              familyId: evalResult.familyId,
              classificationConfidence: evalResult.domainConfidence || 0,
            },
          });

          // Log reclassification events for tracking
          if (evalResult.reclassified && evalResult.originalFamilyKey) {
            console.log(
              `[pipeline] Item ${item.id} reclassified: ${evalResult.originalFamilyKey} → ${evalResult.familyKey}`
            );
          }

          result.itemsEvaluated++;
        }
      } catch (evalError) {
        console.error(
          `[pipeline] Evaluation error for item ${item.id}:`,
          evalError
        );

        try {
          await db.crawledItem.update({
            where: { id: item.id },
            data: { evaluationStatus: 'failed' },
          });
        } catch {
          // ignore secondary error
        }
        result.itemsFailed++;
      }

      pipelineState.progress.current++;

      // Rate limiting - delay between evaluations to avoid 429
      await delay(INTER_EVALUATION_DELAY_MS);
    }

    // Update task evaluation counts
    await db.crawlTask.update({
      where: { id: crawlTask.id },
      data: {
        itemsEvaluated: result.itemsEvaluated,
        itemsFailed: result.itemsFailed,
        itemsSkipped: result.itemsSkipped,
      },
    });

    // ======================================================================
    // PHASE 3: EVOLUTION
    // ======================================================================
    if (triggerEvolution) {
      pipelineState.currentPhase = 'evolving';
      pipelineState.progress = { current: 0, total: familyKeys.length };

      for (const fk of familyKeys) {
        pipelineState.currentFamily = fk;

        // Add delay between family evolutions
        if (pipelineState.progress.current > 0) {
          await delay(3000); // 3 second delay between family evolutions
        }

        try {
          // Check if this family now has >= 3 new evaluations from this task
          const newEvaluatedItems = await db.crawledItem.findMany({
            where: {
              taskId: crawlTask.id,
              familyKey: fk,
              evaluationStatus: 'evaluated',
            },
          });

          if (newEvaluatedItems.length >= 3) {
            const evolveResult = await evolveFamilyInternal({
              familyKey: fk,
            });

            if (!evolveResult.error) {
              result.evolutionTriggered = true;
              result.rulesCreated += evolveResult.createdRules.length;
              result.rulesDeprecated += evolveResult.deprecatedRules.length;

              // Create an EvolutionEvent with type "auto_evolve"
              const family = await db.aestheticFamily.findUnique({
                where: { key: fk },
              });
              if (family) {
                await db.evolutionEvent.create({
                  data: {
                    familyId: family.id,
                    eventType: 'auto_evolve',
                    description: `Auto-evolution triggered by pipeline task ${crawlTask.id}`,
                    metadata: JSON.stringify({
                      taskId: crawlTask.id,
                      familyKey: fk,
                      generation: evolveResult.generation,
                      rulesCreated: evolveResult.createdRules.length,
                      rulesDeprecated: evolveResult.deprecatedRules.length,
                      rulesTransferred: evolveResult.transferredRules.length,
                      reflection: evolveResult.reflection,
                    }),
                    generation: evolveResult.generation,
                  },
                });
              }
            } else {
              console.error(
                `[pipeline] Evolution error for family ${fk}: ${evolveResult.error}`
              );
            }
          }
        } catch (evolveError) {
          console.error(
            `[pipeline] Evolution error for family ${fk}:`,
            evolveError
          );
        }

        pipelineState.progress.current++;
      }
    }

    // ======================================================================
    // COMPLETE
    // ======================================================================
    if (result.itemsDiscovered === 0 && result.itemsEvaluated === 0 && discoveryRateLimited) {
      pipelineState.currentPhase = 'rate_limited';
      pipelineState.error = 'API 请求频率超限 (429)，请等待几分钟后重试。自动重试已包含指数退避，但当前配额可能已耗尽。';
    } else {
      pipelineState.currentPhase = 'complete';
    }

    // Update CrawlTask status to "completed"
    await db.crawlTask.update({
      where: { id: crawlTask.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        itemsEvaluated: result.itemsEvaluated,
        itemsFailed: result.itemsFailed,
        itemsSkipped: result.itemsSkipped,
        evolutionTriggered: result.evolutionTriggered,
        rulesCreated: result.rulesCreated,
        rulesDeprecated: result.rulesDeprecated,
      },
    });

    // Update CrawlSource lastCrawledAt, totalFound, totalEvaluated
    const previousSource = await db.crawlSource.findUnique({
      where: { id: crawlSourceId },
    });
    if (previousSource) {
      await db.crawlSource.update({
        where: { id: crawlSourceId },
        data: {
          lastCrawledAt: new Date(),
          totalFound: previousSource.totalFound + result.itemsDiscovered,
          totalEvaluated:
            previousSource.totalEvaluated + result.itemsEvaluated,
        },
      });
    }

    result.duration = Date.now() - startTime;
  } catch (pipelineError) {
    // ---- Pipeline-level error ----
    const message =
      pipelineError instanceof Error
        ? pipelineError.message
        : 'Unknown pipeline error';
    console.error('[pipeline] Pipeline error:', pipelineError);
    pipelineState.currentPhase = 'error';
    pipelineState.error = message;

    // Update CrawlTask status to "failed"
    try {
      await db.crawlTask.update({
        where: { id: crawlTask.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: message,
          itemsEvaluated: result.itemsEvaluated,
          itemsFailed: result.itemsFailed,
          itemsSkipped: result.itemsSkipped,
          evolutionTriggered: result.evolutionTriggered,
          rulesCreated: result.rulesCreated,
          rulesDeprecated: result.rulesDeprecated,
        },
      });
    } catch {
      // ignore secondary error
    }

    result.duration = Date.now() - startTime;
  } finally {
    // ---- Unlock the pipeline ----
    pipelineState.isRunning = false;
    pipelineState.lastRunAt = new Date();
    pipelineState.lastResult = result;
  }

  return result;
}
