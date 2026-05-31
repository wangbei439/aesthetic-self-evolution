// ---------------------------------------------------------------------------
// Internal Evolution Function — core logic from /api/evolution/route.ts
// ---------------------------------------------------------------------------
// This replicates the evolution logic as a callable function so that the
// auto-crawling pipeline can trigger evolution without making an HTTP request.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { getAIProvider } from '@/lib/ai';
import { parseVLMJson } from '@/lib/ai/parse-json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InternalEvolveResult {
  familyKey: string;
  familyName: string;
  generation: number;
  reflection: string;
  deprecatedRules: string[];
  createdRules: Array<{
    id: string;
    ruleContent: string;
    ruleType: string;
  }>;
  transferredRules: Array<{
    id: string;
    ruleContent: string;
    sourceFamilyKey?: string;
  }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal Evolution Function
// ---------------------------------------------------------------------------

export async function evolveFamilyInternal(params: {
  familyKey: string;
}): Promise<InternalEvolveResult> {
  const { familyKey } = params;

  try {
    // ---- Fetch the family ----
    const family = await db.aestheticFamily.findUnique({
      where: { key: familyKey },
    });

    if (!family) {
      return {
        familyKey,
        familyName: '',
        generation: 0,
        reflection: '',
        deprecatedRules: [],
        createdRules: [],
        transferredRules: [],
        error: `Family not found: ${familyKey}`,
      };
    }

    // ---- Fetch recent evaluations (at least 3 to evolve meaningfully) ----
    const recentEvaluations = await db.aestheticEvaluation.findMany({
      where: { familyId: family.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (recentEvaluations.length < 3) {
      return {
        familyKey,
        familyName: family.name,
        generation: 0,
        reflection: '',
        deprecatedRules: [],
        createdRules: [],
        transferredRules: [],
        error: `Need at least 3 evaluations (current: ${recentEvaluations.length})`,
      };
    }

    // ---- Fetch current active rules ----
    const activeRules = await db.aestheticRule.findMany({
      where: { familyId: family.id, status: 'active' },
      orderBy: { priority: 'desc' },
    });

    // ---- Determine current generation ----
    const latestRule = await db.aestheticRule.findFirst({
      where: { familyId: family.id },
      orderBy: { generation: 'desc' },
      select: { generation: true },
    });
    const currentGeneration = (latestRule?.generation || 0) + 1;

    // ---- Step 1: Reflection phase ----
    const criteria = JSON.parse(family.criteria) as {
      dimensions: { key: string; name: string; desc: string }[];
    };

    const evaluationSummary = recentEvaluations.map((e, i) => {
      const dimScores = JSON.parse(e.dimensionScores) as Record<string, number>;
      const strengths = JSON.parse(e.strengths) as string[];
      const weaknesses = JSON.parse(e.weaknesses) as string[];
      return `Evaluation #${i + 1} (Score: ${e.overallScore.toFixed(1)}/10):
  Dimension scores: ${Object.entries(dimScores).map(([k, v]) => `${k}=${v}`).join(', ')}
  Strengths: ${strengths.join('; ')}
  Weaknesses: ${weaknesses.join('; ')}`;
    });

    const currentRulesSummary = activeRules
      .map(
        (r) =>
          `[${r.ruleType}] (priority: ${r.priority.toFixed(2)}, confidence: ${r.confidence.toFixed(2)}, support: ${r.supportCount}, contradict: ${r.contradictCount}) ${r.dimension ? `(${r.dimension})` : ''} ${r.ruleContent}`
      )
      .join('\n');

    const highScoring = recentEvaluations.filter((e) => e.overallScore >= 7);
    const lowScoring = recentEvaluations.filter((e) => e.overallScore <= 4);

    const reflectionPrompt = `You are an aesthetic evolution engine analyzing patterns in past evaluations to refine aesthetic rules.

Family: ${family.name} (${family.key})
Description: ${family.description}

Evaluation Dimensions:
${criteria.dimensions.map((d) => `- ${d.key} (${d.name}): ${d.desc}`).join('\n')}

Recent Evaluations (${recentEvaluations.length} total):
${evaluationSummary.join('\n\n')}

High-scoring works (>=7): ${highScoring.length}
Low-scoring works (<=4): ${lowScoring.length}

Current Active Rules:
${currentRulesSummary || '(No active rules yet)'}

Based on the patterns you observe:
1. What common qualities do high-scoring works share? (positive rules)
2. What common flaws appear in low-scoring works? (negative rules)
3. Are there any contextual factors that affect evaluation? (conditional rules)
4. Should any existing rules be deprecated because they have low confidence or high contradiction rates?

Generate up to 5 new or modified aesthetic rules. Each rule should be specific, actionable, and derived from the evaluation data.

Respond ONLY in valid JSON format:
{
  "reflection": "Your analysis of the patterns observed",
  "deprecatedRuleIds": [],
  "newRules": [
    {
      "ruleContent": "specific rule description",
      "ruleType": "positive|negative|conditional",
      "dimension": "related dimension key or null",
      "priority": 0.0_to_1.0,
      "parentRuleId": "id of rule this evolves from, or null"
    }
  ]
}`;

    // ---- Initialize AI provider and perform reflection ----
    const ai = await getAIProvider();

    const reflectionResponse = await ai.chat({
      messages: [
        {
          role: 'system',
          content:
            'You are an aesthetic evolution engine. Always respond with valid JSON only. No markdown, no extra text.',
        },
        {
          role: 'user',
          content: reflectionPrompt,
        },
      ],
    });

    const reflectionText = reflectionResponse.content;

    interface ReflectionResult {
      reflection: string;
      deprecatedRuleIds: string[];
      newRules: {
        ruleContent: string;
        ruleType: string;
        dimension: string | null;
        priority: number;
        parentRuleId: string | null;
      }[];
    }

    const reflectionResult = parseVLMJson<ReflectionResult>(reflectionText);

    if (!reflectionResult) {
      // Record failed evolution event
      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: 'reflection',
          description:
            'Evolution cycle failed: could not parse AI reflection output',
          metadata: JSON.stringify({
            rawResponse: reflectionText.substring(0, 500),
          }),
          generation: currentGeneration,
        },
      });

      return {
        familyKey,
        familyName: family.name,
        generation: currentGeneration,
        reflection: '',
        deprecatedRules: [],
        createdRules: [],
        transferredRules: [],
        error: 'Failed to parse evolution reflection from AI model',
      };
    }

    // ---- Step 2: Record reflection event ----
    await db.evolutionEvent.create({
      data: {
        familyId: family.id,
        eventType: 'reflection',
        description: reflectionResult.reflection,
        metadata: JSON.stringify({
          evaluationCount: recentEvaluations.length,
          highScoringCount: highScoring.length,
          lowScoringCount: lowScoring.length,
        }),
        generation: currentGeneration,
      },
    });

    // ---- Step 3: Deprecate rules if recommended ----
    const deprecatedRules: string[] = [];
    for (const ruleId of reflectionResult.deprecatedRuleIds || []) {
      const rule = await db.aestheticRule.findUnique({
        where: { id: ruleId },
      });
      if (rule && rule.familyId === family.id) {
        await db.aestheticRule.update({
          where: { id: ruleId },
          data: { status: 'deprecated' },
        });
        deprecatedRules.push(ruleId);

        await db.evolutionEvent.create({
          data: {
            familyId: family.id,
            eventType: 'rule_deprecated',
            description: `Rule deprecated: "${rule.ruleContent}"`,
            metadata: JSON.stringify({
              ruleId,
              reason: 'Low confidence or high contradiction rate',
              previousConfidence: rule.confidence,
              supportCount: rule.supportCount,
              contradictCount: rule.contradictCount,
            }),
            generation: currentGeneration,
          },
        });
      }
    }

    // ---- Step 4: Create new rules ----
    const createdRules: Array<{
      id: string;
      ruleContent: string;
      ruleType: string;
    }> = [];

    for (const newRule of reflectionResult.newRules || []) {
      // Validate rule type
      if (!['positive', 'negative', 'conditional'].includes(newRule.ruleType)) {
        continue;
      }

      // Validate dimension exists in criteria
      if (
        newRule.dimension &&
        !criteria.dimensions.find((d) => d.key === newRule.dimension)
      ) {
        newRule.dimension = null;
      }

      const createdRule = await db.aestheticRule.create({
        data: {
          familyId: family.id,
          ruleContent: newRule.ruleContent,
          ruleType: newRule.ruleType,
          dimension: newRule.dimension,
          priority: Math.max(0, Math.min(1, newRule.priority || 0.5)),
          generation: currentGeneration,
          parentId: newRule.parentRuleId || null,
          sourceType: 'evolved',
          status: 'active',
          confidence: 0.5,
        },
      });

      createdRules.push({
        id: createdRule.id,
        ruleContent: createdRule.ruleContent,
        ruleType: createdRule.ruleType,
      });

      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: newRule.parentRuleId ? 'rule_modified' : 'rule_created',
          description: `New rule: "${newRule.ruleContent}"`,
          metadata: JSON.stringify({
            ruleId: createdRule.id,
            ruleType: newRule.ruleType,
            dimension: newRule.dimension,
            priority: newRule.priority,
            parentId: newRule.parentRuleId,
          }),
          generation: currentGeneration,
        },
      });
    }

    // ---- Step 5: Cross-family knowledge transfer ----
    const allFamilies = await db.aestheticFamily.findMany({
      where: { key: { not: familyKey } },
      include: {
        rules: {
          where: {
            status: 'active',
            confidence: { gte: 0.7 },
            supportCount: { gte: 3 },
          },
          orderBy: { confidence: 'desc' },
          take: 3,
        },
      },
    });

    const transferableRules: {
      sourceFamilyKey: string;
      sourceFamilyName: string;
      ruleContent: string;
      ruleType: string;
    }[] = [];

    for (const otherFamily of allFamilies) {
      for (const rule of otherFamily.rules) {
        if (rule.supportCount >= 3 && rule.confidence >= 0.7) {
          transferableRules.push({
            sourceFamilyKey: otherFamily.key,
            sourceFamilyName: otherFamily.name,
            ruleContent: rule.ruleContent,
            ruleType: rule.ruleType,
          });
        }
      }
    }

    const transferredRules: Array<{
      id: string;
      ruleContent: string;
      sourceFamilyKey?: string;
    }> = [];

    if (transferableRules.length > 0) {
      const transferPrompt = `You are evaluating whether aesthetic rules from other domains can be adapted for the "${family.name}" domain.

Family: ${family.name} (${family.key})
Description: ${family.description}

Rules from other families that have shown high confidence:
${transferableRules
  .map(
    (r, i) =>
      `${i + 1}. [${r.ruleType}] From "${r.sourceFamilyName}": ${r.ruleContent}`
  )
  .join('\n')}

Which of these rules (if any) could be meaningfully adapted for the "${family.name}" domain? 
For each adaptable rule, rephrase it specifically for this domain.

Respond ONLY in valid JSON format:
{
  "transferableRules": [
    {
      "originalRule": "the original rule content",
      "adaptedRule": "rephrased rule for this domain",
      "ruleType": "positive|negative|conditional",
      "dimension": "matching dimension key from this family or null",
      "priority": 0.0_to_1.0
    }
  ]
}`;

      const transferResponse = await ai.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are an aesthetic knowledge transfer engine. Always respond with valid JSON only.',
          },
          { role: 'user', content: transferPrompt },
        ],
      });

      const transferText = transferResponse.content;

      interface TransferResult {
        transferableRules: {
          originalRule: string;
          adaptedRule: string;
          ruleType: string;
          dimension: string | null;
          priority: number;
        }[];
      }

      const transferResult = parseVLMJson<TransferResult>(transferText);

      if (transferResult?.transferableRules?.length) {
        for (const tr of transferResult.transferableRules) {
          if (
            !['positive', 'negative', 'conditional'].includes(tr.ruleType)
          ) {
            continue;
          }
          if (
            tr.dimension &&
            !criteria.dimensions.find((d) => d.key === tr.dimension)
          ) {
            tr.dimension = null;
          }

          const sourceFamily = allFamilies.find((f) =>
            transferableRules.some(
              (r) =>
                r.sourceFamilyKey === f.key &&
                r.ruleContent === tr.originalRule
            )
          );

          const newRule = await db.aestheticRule.create({
            data: {
              familyId: family.id,
              ruleContent: tr.adaptedRule,
              ruleType: tr.ruleType,
              dimension: tr.dimension,
              priority: Math.max(0, Math.min(1, tr.priority || 0.5)),
              generation: currentGeneration,
              sourceType: 'transferred',
              sourceFamilyId: sourceFamily?.id || null,
              status: 'candidate',
              confidence: 0.3,
            },
          });

          transferredRules.push({
            id: newRule.id,
            ruleContent: newRule.ruleContent,
            sourceFamilyKey: sourceFamily?.key,
          });

          await db.evolutionEvent.create({
            data: {
              familyId: family.id,
              eventType: 'transfer_attempt',
              description: `Transfer attempt: adapted rule from "${sourceFamily?.name || 'unknown'}" → "${tr.adaptedRule}"`,
              metadata: JSON.stringify({
                ruleId: newRule.id,
                originalRule: tr.originalRule,
                adaptedRule: tr.adaptedRule,
                sourceFamilyId: sourceFamily?.id,
              }),
              generation: currentGeneration,
            },
          });
        }

        if (transferredRules.length > 0) {
          await db.evolutionEvent.create({
            data: {
              familyId: family.id,
              eventType: 'transfer_success',
              description: `Successfully transferred ${transferredRules.length} rule(s) from other families`,
              metadata: JSON.stringify({
                count: transferredRules.length,
                sources: [
                  ...new Set(
                    transferredRules
                      .map((r) => r.sourceFamilyKey)
                      .filter(Boolean)
                  ),
                ],
              }),
              generation: currentGeneration,
            },
          });
        }
      } else {
        await db.evolutionEvent.create({
          data: {
            familyId: family.id,
            eventType: 'transfer_failed',
            description:
              'No suitable rules could be transferred from other families',
            generation: currentGeneration,
          },
        });
      }
    }

    // ---- Return evolution result ----
    return {
      familyKey,
      familyName: family.name,
      generation: currentGeneration,
      reflection: reflectionResult.reflection,
      deprecatedRules,
      createdRules,
      transferredRules,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[evolveFamilyInternal] Error:', error);
    return {
      familyKey,
      familyName: '',
      generation: 0,
      reflection: '',
      deprecatedRules: [],
      createdRules: [],
      transferredRules: [],
      error: message,
    };
  }
}
