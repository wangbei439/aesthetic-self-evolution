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
    | 'error';
  currentFamily: string | null;
  progress: { current: number; total: number };
  lastRunAt: Date | null;
  lastResult: PipelineResult | null;
  error: string | null;
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
// In-memory pipeline state (singleton)
// ---------------------------------------------------------------------------

const pipelineState: PipelineStatus = {
  isRunning: false,
  currentPhase: 'idle',
  currentFamily: null,
  progress: { current: 0, total: 0 },
  lastRunAt: null,
  lastResult: null,
  error: null,
};

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
    pipelineState.progress = { current: 0, total: familyKeys.length };

    for (const fk of familyKeys) {
      pipelineState.currentFamily = fk;

      try {
        const discoveredItems = await discoverImagesForFamily(
          fk,
          undefined,
          maxItemsPerFamily
        );

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
        const evalResult = await evaluateImageInternal({
          imageBase64,
          familyKey: item.familyKey || undefined,
          language,
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
          await db.crawledItem.update({
            where: { id: item.id },
            data: {
              evaluationStatus: 'evaluated',
              evaluationId: evalResult.evaluationId,
              overallScore: evalResult.overallScore,
              familyKey: evalResult.familyKey,
              familyId: evalResult.familyId,
            },
          });
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

      // Rate limiting - 1 second delay between evaluations
      await delay(1000);
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
    pipelineState.currentPhase = 'complete';

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
