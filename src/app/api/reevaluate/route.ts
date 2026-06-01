import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { parseVLMJson } from "@/lib/ai/parse-json";

// ---------------------------------------------------------------------------
// POST /api/reevaluate — Re-evaluate an existing evaluation with current rules
// Body: { evaluationId: string }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { evaluationId, language: languageParam } = body;
    const language: 'zh' | 'en' = languageParam === 'zh' ? 'zh' : 'en';

    if (!evaluationId) {
      return NextResponse.json(
        { error: "Missing 'evaluationId' in request body" },
        { status: 400 }
      );
    }

    // Fetch the existing evaluation
    const existingEval = await db.aestheticEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        family: true,
      },
    });

    if (!existingEval) {
      return NextResponse.json(
        { error: `Evaluation not found with id: ${evaluationId}` },
        { status: 404 }
      );
    }

    // Get the image data from the existing evaluation
    if (!existingEval.imageUrl) {
      return NextResponse.json(
        { error: "Original image data not available for re-evaluation" },
        { status: 400 }
      );
    }

    const imageBase64 = existingEval.imageUrl;

    // Fetch the family with current active rules
    const family = await db.aestheticFamily.findUnique({
      where: { id: existingEval.familyId },
      include: {
        rules: {
          where: { status: "active" },
          orderBy: { priority: "desc" },
        },
      },
    });

    if (!family) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    // Build evaluation prompt
    const criteria = JSON.parse(family.criteria) as {
      dimensions: { key: string; name: string; desc: string }[];
    };

    const dimensionsList = criteria.dimensions
      .map((d, i) => `${i + 1}. ${d.key} (${d.name}): ${d.desc}`)
      .join("\n");

    let ruleContext = "";
    if (family.rules.length > 0) {
      const positiveRules = family.rules.filter((r) => r.ruleType === "positive");
      const negativeRules = family.rules.filter((r) => r.ruleType === "negative");
      const conditionalRules = family.rules.filter((r) => r.ruleType === "conditional");

      if (positiveRules.length > 0) {
        ruleContext += `\n\nPositive rules (qualities to look for):\n${positiveRules.map((r) => `- ${r.ruleContent}`).join("\n")}`;
      }
      if (negativeRules.length > 0) {
        ruleContext += `\n\nNegative rules (pitfalls to watch for):\n${negativeRules.map((r) => `- ${r.ruleContent}`).join("\n")}`;
      }
      if (conditionalRules.length > 0) {
        ruleContext += `\n\nConditional rules (context-dependent considerations):\n${conditionalRules.map((r) => `- ${r.ruleContent}`).join("\n")}`;
      }
    }

    const familyNameMap: Record<string, string> = {
      narrative_visual: "Cinematic/Visual Narrative",
      interactive_ui: "UI/Interface Design",
      spatial: "Spatial/Environmental Design",
      character: "Character/Figure Design",
      graphic_composition: "Graphic/Print Composition",
      dynamic_rhythm: "Dynamic/Motion Design",
    };

    const langInstruction = language === 'zh'
      ? `重要：你必须用中文撰写所有文本内容（维度评注、优势、不足、建议、综合评估、与上次对比）。JSON的键名保持英文，但所有值（字符串内容）必须使用中文。`
      : `Write all text content in English.`;

    const jsonExample = language === 'zh'
      ? `{
  "dimensionScores": {${criteria.dimensions.map((d) => `"${d.key}": 0`).join(", ")}},
  "dimensionNotes": {${criteria.dimensions.map((d) => `"${d.key}": "中文简要评注"`).join(", ")}},
  "overallScore": 0.0,
  "strengths": ["中文优势1", "中文优势2", "中文优势3"],
  "weaknesses": ["中文不足1", "中文不足2"],
  "suggestions": ["中文具体建议1", "中文具体建议2", "中文具体建议3"],
  "evaluation": "中文综合评估段落。",
  "comparisonWithPrevious": "中文简要说明与上次评估的差异"
}`
      : `{
  "dimensionScores": {${criteria.dimensions.map((d) => `"${d.key}": 0`).join(", ")}},
  "dimensionNotes": {${criteria.dimensions.map((d) => `"${d.key}": "brief note"`).join(", ")}},
  "overallScore": 0.0,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2", "specific actionable suggestion 3"],
  "evaluation": "A detailed natural language assessment paragraph.",
  "comparisonWithPrevious": "Brief note on how this evaluation differs from the previous one due to rule updates"
}`;

    const evaluationPrompt = `You are an expert aesthetic evaluator specializing in ${familyNameMap[family.key] || family.name}. 
${family.description}

${langInstruction}

Evaluate this image on these 5 dimensions (score each 0-10, where 0 is terrible and 10 is masterful):
${dimensionsList}
${ruleContext}

This is a RE-EVALUATION. The previous evaluation scored ${existingEval.overallScore.toFixed(1)}/10.
Compare your new evaluation with the previous one and note any differences caused by updated rules.

For each dimension, provide a score and brief justification. Then provide an overall assessment.

Respond ONLY in valid JSON format:
${jsonExample}

Be specific, insightful, and constructive. Avoid generic praise. Focus on observable visual qualities.`;

    // Initialize AI provider and perform re-evaluation
    const ai = await getAIProvider();
    const providerInfo = ai.getInfo();

    const evaluationResponse = await ai.visionChat({
      messages: [
        {
          role: "system",
          content:
            "You are a world-class aesthetic evaluator. Always respond with valid JSON only. No markdown, no extra text.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: evaluationPrompt },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
    });

    const evaluationText = evaluationResponse.content;

    interface EvaluationResult {
      dimensionScores: Record<string, number>;
      dimensionNotes?: Record<string, string>;
      overallScore: number;
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
      evaluation: string;
      comparisonWithPrevious?: string;
    }

    const evaluationResult = parseVLMJson<EvaluationResult>(evaluationText);

    if (!evaluationResult || !evaluationResult.dimensionScores) {
      return NextResponse.json(
        {
          error: "Failed to parse re-evaluation results from AI model",
          rawResponse: evaluationText,
        },
        { status: 422 }
      );
    }

    // Determine evolution generation
    const latestEvaluation = await db.aestheticEvaluation.findFirst({
      where: { familyId: family.id },
      orderBy: { evolutionGeneration: "desc" },
      select: { evolutionGeneration: true },
    });
    const currentGeneration = (latestEvaluation?.evolutionGeneration || 0) + 1;

    // Get the latest rule version
    const latestRule = await db.aestheticRule.findFirst({
      where: { familyId: family.id },
      orderBy: { generation: "desc" },
      select: { generation: true },
    });
    const ruleVersionUsed = latestRule
      ? `gen-${latestRule.generation}`
      : null;

    // Save re-evaluation to database
    const savedEvaluation = await db.aestheticEvaluation.create({
      data: {
        familyId: family.id,
        imageUrl: imageBase64,
        detectedDomain: existingEval.detectedDomain,
        domainConfidence: existingEval.domainConfidence,
        overallScore: evaluationResult.overallScore || 0,
        dimensionScores: JSON.stringify(evaluationResult.dimensionScores),
        dimensionNotes: JSON.stringify(evaluationResult.dimensionNotes || {}),
        evaluation: evaluationResult.evaluation || "",
        suggestions: JSON.stringify(evaluationResult.suggestions || []),
        strengths: JSON.stringify(evaluationResult.strengths || []),
        weaknesses: JSON.stringify(evaluationResult.weaknesses || []),
        evolutionGeneration: currentGeneration,
        ruleVersionUsed: ruleVersionUsed,
      },
    });

    // Update rule support/contradict counts
    for (const rule of family.rules) {
      if (rule.dimension) {
        const dimScore = evaluationResult.dimensionScores[rule.dimension];
        if (dimScore !== undefined) {
          const isSupporting =
            (rule.ruleType === "positive" && dimScore >= 7) ||
            (rule.ruleType === "negative" && dimScore <= 4);

          if (isSupporting) {
            await db.aestheticRule.update({
              where: { id: rule.id },
              data: {
                supportCount: { increment: 1 },
                confidence: Math.min(
                  1,
                  (rule.supportCount + 1) /
                    (rule.supportCount + rule.contradictCount + 1)
                ),
              },
            });
          } else if (
            (rule.ruleType === "positive" && dimScore <= 4) ||
            (rule.ruleType === "negative" && dimScore >= 7)
          ) {
            await db.aestheticRule.update({
              where: { id: rule.id },
              data: {
                contradictCount: { increment: 1 },
                confidence: Math.max(
                  0,
                  rule.supportCount /
                    (rule.supportCount + rule.contradictCount + 1)
                ),
              },
            });
          }
        }
      }
    }

    // Auto-promote candidate rules
    const candidateRules = await db.aestheticRule.findMany({
      where: {
        familyId: family.id,
        status: "candidate",
        supportCount: { gte: 3 },
        confidence: { gte: 0.5 },
      },
    });

    for (const candidate of candidateRules) {
      await db.aestheticRule.update({
        where: { id: candidate.id },
        data: { status: "active", confidence: 0.5 },
      });

      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: "rule_promoted",
          description: `Candidate rule auto-promoted after re-evaluation: "${candidate.ruleContent}"`,
          metadata: JSON.stringify({
            ruleId: candidate.id,
            action: "auto_promote_reevaluate",
            supportCount: candidate.supportCount,
            contradictCount: candidate.contradictCount,
          }),
          generation: candidate.generation,
        },
      });
    }

    // Return the new evaluation result with comparison
    return NextResponse.json({
      id: savedEvaluation.id,
      family: {
        id: family.id,
        key: family.key,
        name: family.name,
        description: family.description,
        icon: family.icon,
        color: family.color,
        criteria: JSON.parse(family.criteria),
        domains: JSON.parse(family.domains),
      },
      classification: {
        familyKey: family.key,
        detectedDomain: existingEval.detectedDomain,
        confidence: existingEval.domainConfidence,
      },
      evaluation: {
        dimensionScores: evaluationResult.dimensionScores,
        dimensionNotes: evaluationResult.dimensionNotes || {},
        overallScore: evaluationResult.overallScore,
        strengths: evaluationResult.strengths || [],
        weaknesses: evaluationResult.weaknesses || [],
        suggestions: evaluationResult.suggestions || [],
        assessment: evaluationResult.evaluation,
      },
      language,
      modelUsed: {
        evaluation: providerInfo.vlmModel,
      },
      provider: {
        name: providerInfo.providerLabel,
        isSandbox: providerInfo.isSandbox,
      },
      comparisonWithPrevious: evaluationResult.comparisonWithPrevious || null,
      previousScore: existingEval.overallScore,
      scoreDelta: Number((evaluationResult.overallScore - existingEval.overallScore).toFixed(1)),
      previousEvaluationId: evaluationId,
      evolutionGeneration: currentGeneration,
      ruleVersionUsed,
      createdAt: savedEvaluation.createdAt,
    });
  } catch (error) {
    console.error("[API /reevaluate] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to re-evaluate image", details: message },
      { status: 500 }
    );
  }
}
