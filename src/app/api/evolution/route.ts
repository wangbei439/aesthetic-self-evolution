import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { parseVLMJson } from "@/lib/ai/parse-json";

// ---------------------------------------------------------------------------
// GET /api/evolution — Return evolution stats for each family
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const families = await db.aestheticFamily.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            evaluations: true,
            rules: true,
          },
        },
        evaluations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            evolutionGeneration: true,
            overallScore: true,
            createdAt: true,
          },
        },
        rules: {
          where: { status: "active" },
          select: {
            generation: true,
            confidence: true,
            status: true,
            ruleType: true,
          },
        },
      },
    });

    // Fetch recent evolution events per family
    const evolutionStats = await Promise.all(
      families.map(async (family) => {
        const recentEvents = await db.evolutionEvent.findMany({
          where: { familyId: family.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        });

        const totalEvaluations = family._count.evaluations;
        const totalRules = family._count.rules;
        const latestGeneration =
          family.evaluations[0]?.evolutionGeneration || 0;
        const latestScore = family.evaluations[0]?.overallScore || 0;
        const maxRuleGeneration =
          family.rules.length > 0
            ? Math.max(...family.rules.map((r) => r.generation))
            : 0;
        const avgRuleConfidence =
          family.rules.length > 0
            ? family.rules.reduce((sum, r) => sum + r.confidence, 0) /
              family.rules.length
            : 0;

        // Count rules by type
        const rulesByType = {
          positive: family.rules.filter((r) => r.ruleType === "positive")
            .length,
          negative: family.rules.filter((r) => r.ruleType === "negative")
            .length,
          conditional: family.rules.filter((r) => r.ruleType === "conditional")
            .length,
        };

        // Score distribution (average across recent evaluations)
        const recentEvaluations = await db.aestheticEvaluation.findMany({
          where: { familyId: family.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { overallScore: true },
        });

        const avgScore =
          recentEvaluations.length > 0
            ? recentEvaluations.reduce((sum, e) => sum + e.overallScore, 0) /
              recentEvaluations.length
            : 0;

        return {
          familyId: family.id,
          familyKey: family.key,
          familyName: family.name,
          icon: family.icon,
          color: family.color,
          stats: {
            totalEvaluations,
            totalRules,
            latestGeneration,
            maxRuleGeneration,
            latestScore,
            avgScore: Math.round(avgScore * 100) / 100,
            avgRuleConfidence: Math.round(avgRuleConfidence * 100) / 100,
            rulesByType,
          },
          recentEvents: recentEvents.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            description: e.description,
            generation: e.generation,
            metadata: e.metadata ? JSON.parse(e.metadata) : null,
            createdAt: e.createdAt,
          })),
        };
      })
    );

    // Global stats
    const totalEvents = await db.evolutionEvent.count();
    const globalStats = {
      totalFamilies: families.length,
      totalEvaluations: families.reduce(
        (sum, f) => sum + f._count.evaluations,
        0
      ),
      totalRules: families.reduce((sum, f) => sum + f._count.rules, 0),
      totalEvolutionEvents: totalEvents,
    };

    return NextResponse.json({
      globalStats,
      families: evolutionStats,
    });
  } catch (error) {
    console.error("[API /evolution GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch evolution stats" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/evolution — Trigger an evolution cycle for a specific family
// Body: { familyKey: string }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { familyKey } = body;

    if (!familyKey) {
      return NextResponse.json(
        { error: "Missing 'familyKey' in request body" },
        { status: 400 }
      );
    }

    // Fetch the family
    const family = await db.aestheticFamily.findUnique({
      where: { key: familyKey },
    });

    if (!family) {
      return NextResponse.json(
        { error: `Family not found: ${familyKey}` },
        { status: 404 }
      );
    }

    // Fetch recent evaluations (at least 3 to evolve meaningfully)
    const recentEvaluations = await db.aestheticEvaluation.findMany({
      where: { familyId: family.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (recentEvaluations.length < 3) {
      return NextResponse.json(
        {
          error: "Need at least 3 evaluations.",
          familyKey,
          currentCount: recentEvaluations.length,
        },
        { status: 400 }
      );
    }

    // Fetch current active rules
    const activeRules = await db.aestheticRule.findMany({
      where: { familyId: family.id, status: "active" },
      orderBy: { priority: "desc" },
    });

    // Determine current generation
    const latestRule = await db.aestheticRule.findFirst({
      where: { familyId: family.id },
      orderBy: { generation: "desc" },
      select: { generation: true },
    });
    const currentGeneration = (latestRule?.generation || 0) + 1;

    // ---- Step 1: Reflection phase — analyze evaluation patterns ----
    const criteria = JSON.parse(family.criteria) as {
      dimensions: { key: string; name: string; desc: string }[];
    };

    // Build summary of evaluation data for AI analysis
    const evaluationSummary = recentEvaluations.map((e, i) => {
      const dimScores = JSON.parse(e.dimensionScores) as Record<
        string,
        number
      >;
      const strengths = JSON.parse(e.strengths) as string[];
      const weaknesses = JSON.parse(e.weaknesses) as string[];
      return `Evaluation #${i + 1} (Score: ${e.overallScore.toFixed(1)}/10):
  Dimension scores: ${Object.entries(dimScores)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}
  Strengths: ${strengths.join("; ")}
  Weaknesses: ${weaknesses.join("; ")}`;
    });

    const currentRulesSummary = activeRules
      .map(
        (r) =>
          `[${r.ruleType}] (priority: ${r.priority.toFixed(2)}, confidence: ${r.confidence.toFixed(2)}, support: ${r.supportCount}, contradict: ${r.contradictCount}) ${r.dimension ? `(${r.dimension})` : ""} ${r.ruleContent}`
      )
      .join("\n");

    // Separate high and low scoring evaluations
    const highScoring = recentEvaluations.filter((e) => e.overallScore >= 7);
    const lowScoring = recentEvaluations.filter((e) => e.overallScore <= 4);

    const reflectionPrompt = `You are an aesthetic evolution engine analyzing patterns in past evaluations to refine aesthetic rules.

Family: ${family.name} (${family.key})
Description: ${family.description}

Evaluation Dimensions:
${criteria.dimensions.map((d) => `- ${d.key} (${d.name}): ${d.desc}`).join("\n")}

Recent Evaluations (${recentEvaluations.length} total):
${evaluationSummary.join("\n\n")}

High-scoring works (>=7): ${highScoring.length}
Low-scoring works (<=4): ${lowScoring.length}

Current Active Rules:
${currentRulesSummary || "(No active rules yet)"}

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

    // Initialize AI provider and perform reflection
    const ai = await getAIProvider();
    const providerInfo = ai.getInfo();

    const reflectionResponse = await ai.chat({
      messages: [
        {
          role: "system",
          content:
            "You are an aesthetic evolution engine. Always respond with valid JSON only. No markdown, no extra text.",
        },
        {
          role: "user",
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

    // Parse reflection result
    const reflectionResult = parseVLMJson<ReflectionResult>(reflectionText);

    if (!reflectionResult) {
      // Record failed evolution event
      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: "reflection",
          description: "Evolution cycle failed: could not parse AI reflection output",
          metadata: JSON.stringify({ rawResponse: reflectionText.substring(0, 500) }),
          generation: currentGeneration,
        },
      });

      return NextResponse.json(
        {
          error: "Failed to parse evolution reflection from AI model",
          rawResponse: reflectionText,
        },
        { status: 422 }
      );
    }

    // ---- Step 2: Record reflection event ----
    await db.evolutionEvent.create({
      data: {
        familyId: family.id,
        eventType: "reflection",
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
      const rule = await db.aestheticRule.findUnique({ where: { id: ruleId } });
      if (rule && rule.familyId === family.id) {
        await db.aestheticRule.update({
          where: { id: ruleId },
          data: { status: "deprecated" },
        });
        deprecatedRules.push(ruleId);

        await db.evolutionEvent.create({
          data: {
            familyId: family.id,
            eventType: "rule_deprecated",
            description: `Rule deprecated: "${rule.ruleContent}"`,
            metadata: JSON.stringify({
              ruleId,
              reason: "Low confidence or high contradiction rate",
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
    const createdRules = [];
    for (const newRule of reflectionResult.newRules || []) {
      // Validate rule type
      if (!["positive", "negative", "conditional"].includes(newRule.ruleType)) {
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
          sourceType: "evolved",
          status: "active",
          confidence: 0.5, // Start with moderate confidence
        },
      });

      createdRules.push({
        id: createdRule.id,
        ruleContent: createdRule.ruleContent,
        ruleType: createdRule.ruleType,
        dimension: createdRule.dimension,
        priority: createdRule.priority,
        parentId: createdRule.parentId,
      });

      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: newRule.parentRuleId ? "rule_modified" : "rule_created",
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

    // ---- Step 5: Attempt cross-family knowledge transfer ----
    const allFamilies = await db.aestheticFamily.findMany({
      where: { key: { not: familyKey } },
      include: {
        rules: {
          where: {
            status: "active",
            confidence: { gte: 0.7 },
            supportCount: { gte: 3 },
          },
          orderBy: { confidence: "desc" },
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

    if (transferableRules.length > 0) {
      // Attempt transfer: ask AI if any of these rules could apply
      const transferPrompt = `You are evaluating whether aesthetic rules from other domains can be adapted for the "${family.name}" domain.

Family: ${family.name} (${family.key})
Description: ${family.description}

Rules from other families that have shown high confidence:
${transferableRules
  .map(
    (r, i) =>
      `${i + 1}. [${r.ruleType}] From "${r.sourceFamilyName}": ${r.ruleContent}`
  )
  .join("\n")}

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
            role: "system",
            content:
              "You are an aesthetic knowledge transfer engine. Always respond with valid JSON only.",
          },
          { role: "user", content: transferPrompt },
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

      const transferredRules = [];
      if (transferResult?.transferableRules?.length) {
        for (const tr of transferResult.transferableRules) {
          if (
            !["positive", "negative", "conditional"].includes(tr.ruleType)
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
              sourceType: "transferred",
              sourceFamilyId: sourceFamily?.id || null,
              status: "candidate", // Transferred rules start as candidates
              confidence: 0.3, // Lower initial confidence for transferred rules
            },
          });

          transferredRules.push({
            id: newRule.id,
            ruleContent: newRule.ruleContent,
            ruleType: newRule.ruleType,
            dimension: newRule.dimension,
            sourceFamilyKey: sourceFamily?.key,
          });

          await db.evolutionEvent.create({
            data: {
              familyId: family.id,
              eventType: "transfer_attempt",
              description: `Transfer attempt: adapted rule from "${sourceFamily?.name || "unknown"}" → "${tr.adaptedRule}"`,
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
              eventType: "transfer_success",
              description: `Successfully transferred ${transferredRules.length} rule(s) from other families`,
              metadata: JSON.stringify({
                count: transferredRules.length,
                sources: [
                  ...new Set(
                    transferredRules.map((r) => r.sourceFamilyKey).filter(Boolean)
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
            eventType: "transfer_failed",
            description: "No suitable rules could be transferred from other families",
            generation: currentGeneration,
          },
        });
      }
    }

    // ---- Return evolution result ----
    return NextResponse.json({
      familyKey,
      familyName: family.name,
      generation: currentGeneration,
      reflection: reflectionResult.reflection,
      deprecatedRules,
      createdRules,
      evaluationSampleSize: recentEvaluations.length,
      modelUsed: {
        reflection: providerInfo.llmModel,
        transfer: transferableRules.length > 0 ? providerInfo.llmModel : null,
      },
      provider: {
        name: providerInfo.providerLabel,
        isSandbox: providerInfo.isSandbox,
      },
    });
  } catch (error) {
    console.error("[API /evolution POST] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to trigger evolution cycle", details: message },
      { status: 500 }
    );
  }
}
