import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

// ---------------------------------------------------------------------------
// Helper: convert a File (from FormData) to a base64 data-URL string
// ---------------------------------------------------------------------------
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  return `data:${file.type || "image/png"};base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Helper: safely parse JSON from VLM response text
// ---------------------------------------------------------------------------
function parseVLMJson<T = unknown>(text: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(text) as T;
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        return null;
      }
    }
    // Try to find the first { ... } block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Domain classification prompt (used when familyKey is not provided)
// ---------------------------------------------------------------------------
const CLASSIFICATION_PROMPT = `Analyze this image and determine which aesthetic domain it belongs to. Choose ONE from:
- narrative_visual: Cinematic shots, film stills, game cutscenes, story-driven visuals, photography with narrative intent
- interactive_ui: User interfaces, web pages, app screens, dashboards, game HUDs, data visualizations
- spatial: Environments, architecture, interiors, 3D scenes, game levels, landscapes
- character: Character designs, fashion, portraits, digital humans, cosplay, costume
- graphic_composition: Posters, illustrations, branding, print design, logo, packaging
- dynamic_rhythm: Motion graphics, animation frames, visual effects, dance, dynamic action scenes

Respond ONLY in valid JSON format:
{"familyKey": "one_of_the_keys_above", "confidence": 0.0_to_1.0, "detectedDomain": "brief description of detected domain"}`;

// ---------------------------------------------------------------------------
// Family-specific evaluation prompt builder
// ---------------------------------------------------------------------------
interface CriterionDimension {
  key: string;
  name: string;
  desc: string;
}

function buildEvaluationPrompt(
  familyKey: string,
  familyName: string,
  familyDescription: string,
  criteriaJson: string,
  rules: { ruleContent: string; ruleType: string; dimension: string | null }[]
): string {
  const criteria = JSON.parse(criteriaJson) as {
    dimensions: CriterionDimension[];
  };
  const dimensionsList = criteria.dimensions
    .map(
      (d, i) =>
        `${i + 1}. ${d.key} (${d.name}): ${d.desc}`
    )
    .join("\n");

  // Build rule context if there are active rules
  let ruleContext = "";
  if (rules.length > 0) {
    const positiveRules = rules.filter((r) => r.ruleType === "positive");
    const negativeRules = rules.filter((r) => r.ruleType === "negative");
    const conditionalRules = rules.filter(
      (r) => r.ruleType === "conditional"
    );

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

  return `You are an expert aesthetic evaluator specializing in ${familyNameMap[familyKey] || familyName}. 
${familyDescription}

Evaluate this image on these 5 dimensions (score each 0-10, where 0 is terrible and 10 is masterful):
${dimensionsList}
${ruleContext}

For each dimension, provide a score and brief justification. Then provide an overall assessment.

Respond ONLY in valid JSON format:
{
  "dimensionScores": {${criteria.dimensions.map((d) => `"${d.key}": 0`).join(", ")}},
  "dimensionNotes": {${criteria.dimensions.map((d) => `"${d.key}": "brief note"`).join(", ")}},
  "overallScore": 0.0,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2", "specific actionable suggestion 3"],
  "evaluation": "A detailed natural language assessment paragraph covering the overall aesthetic quality, notable elements, and areas for improvement."
}

Be specific, insightful, and constructive. Avoid generic praise. Focus on observable visual qualities.`;
}

// ---------------------------------------------------------------------------
// POST /api/evaluate
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    // ---- Parse form data ----
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid request: expected multipart/form-data with an image file" },
        { status: 400 }
      );
    }
    const imageFile = formData.get("image");
    const imageUrl = formData.get("imageUrl") as string | null;
    const familyKeyParam = formData.get("familyKey") as string | null;

    let imageBase64: string;

    if (imageFile && imageFile instanceof File) {
      // Validate file size (max 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image file too large (max 10MB)" },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/bmp",
      ];
      if (!allowedTypes.includes(imageFile.type)) {
        return NextResponse.json(
          { error: `Unsupported image type: ${imageFile.type}` },
          { status: 400 }
        );
      }

      // ---- Convert image to base64 ----
      imageBase64 = await fileToBase64(imageFile);
    } else if (imageUrl && imageUrl.trim()) {
      // ---- Fetch image from URL ----
      try {
        const urlRes = await fetch(imageUrl.trim(), {
          headers: {
            'User-Agent': 'Aesthetic-Self-Evolution/1.0',
          },
        });
        if (!urlRes.ok) {
          return NextResponse.json(
            { error: `Failed to fetch image from URL: ${urlRes.status} ${urlRes.statusText}` },
            { status: 400 }
          );
        }
        const contentType = urlRes.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          return NextResponse.json(
            { error: `URL does not point to an image (content-type: ${contentType})` },
            { status: 400 }
          );
        }
        const arrayBuffer = await urlRes.arrayBuffer();
        if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "Image from URL too large (max 10MB)" },
            { status: 400 }
          );
        }
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        imageBase64 = `data:${contentType};base64,${base64}`;
      } catch (fetchErr) {
        return NextResponse.json(
          { error: `Failed to fetch image from URL: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Missing 'image' file or 'imageUrl' in form data" },
        { status: 400 }
      );
    }

    // ---- Initialize VLM client ----
    const zai = await ZAI.create();

    // ---- Step 1: Classify the image domain (if familyKey not provided) ----
    let familyKey: string;
    let detectedDomain: string | null = null;
    let domainConfidence = 0;

    if (familyKeyParam) {
      // Validate the provided familyKey
      const family = await db.aestheticFamily.findUnique({
        where: { key: familyKeyParam },
      });
      if (!family) {
        return NextResponse.json(
          {
            error: `Invalid familyKey: ${familyKeyParam}. Valid keys are: narrative_visual, interactive_ui, spatial, character, graphic_composition, dynamic_rhythm`,
          },
          { status: 400 }
        );
      }
      familyKey = familyKeyParam;
    } else {
      // Auto-classify using VLM
      const classificationResponse = await zai.chat.completions.createVision({
        model: "qwen2.5-vl-72b-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: CLASSIFICATION_PROMPT },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      });

      const classificationText =
        classificationResponse?.choices?.[0]?.message?.content || "";
      const classificationResult = parseVLMJson<{
        familyKey: string;
        confidence: number;
        detectedDomain: string;
      }>(classificationText);

      if (
        !classificationResult ||
        !classificationResult.familyKey
      ) {
        return NextResponse.json(
          {
            error: "Failed to classify image domain. Please provide a familyKey manually.",
            rawResponse: classificationText,
          },
          { status: 422 }
        );
      }

      // Validate the classified key exists
      const validKeys = [
        "narrative_visual",
        "interactive_ui",
        "spatial",
        "character",
        "graphic_composition",
        "dynamic_rhythm",
      ];
      if (!validKeys.includes(classificationResult.familyKey)) {
        return NextResponse.json(
          {
            error: `Classified to unknown family: ${classificationResult.familyKey}`,
            rawResponse: classificationText,
          },
          { status: 422 }
        );
      }

      familyKey = classificationResult.familyKey;
      detectedDomain = classificationResult.detectedDomain || null;
      domainConfidence = classificationResult.confidence || 0;
    }

    // ---- Step 2: Fetch family and its active rules ----
    const family = await db.aestheticFamily.findUnique({
      where: { key: familyKey },
      include: {
        rules: {
          where: { status: "active" },
          orderBy: { priority: "desc" },
        },
      },
    });

    if (!family) {
      return NextResponse.json(
        { error: `Family not found: ${familyKey}` },
        { status: 404 }
      );
    }

    // ---- Step 3: Evaluate using family-specific criteria ----
    const evaluationPrompt = buildEvaluationPrompt(
      family.key,
      family.name,
      family.description,
      family.criteria,
      family.rules.map((r) => ({
        ruleContent: r.ruleContent,
        ruleType: r.ruleType,
        dimension: r.dimension,
      }))
    );

    const evaluationResponse = await zai.chat.completions.createVision({
      model: "qwen2.5-vl-72b-instruct",
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

    const evaluationText =
      evaluationResponse?.choices?.[0]?.message?.content || "";

    interface EvaluationResult {
      dimensionScores: Record<string, number>;
      dimensionNotes?: Record<string, string>;
      overallScore: number;
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
      evaluation: string;
    }

    const evaluationResult = parseVLMJson<EvaluationResult>(evaluationText);

    if (!evaluationResult || !evaluationResult.dimensionScores) {
      return NextResponse.json(
        {
          error: "Failed to parse evaluation results from VLM",
          rawResponse: evaluationText,
        },
        { status: 422 }
      );
    }

    // ---- Step 4: Determine evolution generation ----
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

    // ---- Step 5: Save evaluation to database ----
    const savedEvaluation = await db.aestheticEvaluation.create({
      data: {
        familyId: family.id,
        imageUrl: imageBase64, // Store full base64 for future reference and re-evaluation
        detectedDomain: detectedDomain,
        domainConfidence: domainConfidence,
        overallScore: evaluationResult.overallScore || 0,
        dimensionScores: JSON.stringify(evaluationResult.dimensionScores),
        evaluation: evaluationResult.evaluation || "",
        suggestions: JSON.stringify(evaluationResult.suggestions || []),
        strengths: JSON.stringify(evaluationResult.strengths || []),
        weaknesses: JSON.stringify(evaluationResult.weaknesses || []),
        evolutionGeneration: currentGeneration,
        ruleVersionUsed: ruleVersionUsed,
      },
    });

    // ---- Step 6: Update rule support/contradict counts based on evaluation ----
    for (const rule of family.rules) {
      if (rule.dimension) {
        const dimScore = evaluationResult.dimensionScores[rule.dimension];
        if (dimScore !== undefined) {
          // If the dimension scored well and rule is positive, increment support
          // If the dimension scored poorly and rule is negative, increment support
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

    // ---- Step 7: Auto-promote candidate rules that have enough support ----
    const candidateRules = await db.aestheticRule.findMany({
      where: {
        familyId: family.id,
        status: "candidate",
        supportCount: { gte: 3 },
        confidence: { gte: 0.5 },
      },
    });

    const promotedRules: string[] = [];
    for (const candidate of candidateRules) {
      await db.aestheticRule.update({
        where: { id: candidate.id },
        data: {
          status: "active",
          confidence: 0.5,
        },
      });

      promotedRules.push(candidate.id);

      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: "rule_created",
          description: `Candidate rule auto-promoted to active: "${candidate.ruleContent}"`,
          metadata: JSON.stringify({
            ruleId: candidate.id,
            action: "auto_promote",
            previousStatus: "candidate",
            previousConfidence: candidate.confidence,
            newConfidence: 0.5,
            supportCount: candidate.supportCount,
            contradictCount: candidate.contradictCount,
          }),
          generation: candidate.generation,
        },
      });
    }

    // ---- Return structured result ----
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
        familyKey,
        detectedDomain: detectedDomain,
        confidence: domainConfidence,
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
      evolutionGeneration: currentGeneration,
      ruleVersionUsed,
      createdAt: savedEvaluation.createdAt,
    });
  } catch (error) {
    console.error("[API /evaluate] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to evaluate image", details: message },
      { status: 500 }
    );
  }
}
