// ---------------------------------------------------------------------------
// Internal Evaluation Function — core logic from /api/evaluate/route.ts
// ---------------------------------------------------------------------------
// This replicates the evaluation logic as a callable function so that the
// auto-crawling pipeline can evaluate images without making an HTTP request.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { getAIProvider } from '@/lib/ai';
import { parseVLMJson } from '@/lib/ai/parse-json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InternalEvalResult {
  evaluationId: string;
  familyKey: string;
  familyId: string;
  overallScore: number;
  dimensionScores: Record<string, number>;
  evaluation: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  detectedDomain?: string | null;
  domainConfidence?: number;
  /** True if VLM reclassified the image to a different family than the one provided */
  reclassified?: boolean;
  /** The original familyKey before reclassification */
  originalFamilyKey?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Domain classification prompt — enhanced with detailed discriminating criteria
// and bilingual descriptions for better accuracy
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = `You are an expert aesthetic domain classifier. Analyze this image carefully and determine which ONE aesthetic family it belongs to.

## Aesthetic Families (choose exactly ONE):

1. **narrative_visual** (叙事视觉) — Cinematic shots, film stills, game cutscenes, storytelling photography, photojournalism, editorial photography with narrative intent.
   *Key signals*: Story being told, sequential feel, emotional moment captured, cinematic composition, dramatic lighting.

2. **interactive_ui** (交互界面) — User interfaces, web pages, app screens, dashboards, game HUDs, data visualizations, wireframes.
   *Key signals*: Buttons, menus, forms, navigation elements, data charts, layout grids, interactive components visible.

3. **spatial** (空间营造) — Architecture, interiors, 3D environments, landscapes, cityscapes, room designs, game levels.
   *Key signals*: Space/room as subject, architectural structures, depth/perspective, environment focus, NOT a person-focused shot.

4. **character** (人物造型) — Character designs, fashion photography, portraits, digital humans, cosplay, costume design, figure studies.
   *Key signals*: Person/people as primary subject, face or body prominently featured, clothing/costume focus, character sheet.

5. **graphic_composition** (平面构成) — Posters, illustrations, branding, print design, logo design, packaging, typography-focused design, flat compositions.
   *Key signals*: 2D flat design, text/typography prominent, graphic layout, brand identity, vector-style illustration, no 3D depth.

6. **dynamic_rhythm** (动态韵律) — Motion graphics frames, animation stills, visual effects, dance photography, action/sports shots, dynamic movement captured.
   *Key signals*: Motion blur, dynamic pose, implied movement, rhythm/repetition, action frozen in time, kinetic energy.

## Important Discrimination Rules:
- If an image shows a person in an environment, decide: is the PERSON the subject (→ character) or the SPACE the subject (→ spatial)?
- If an image has text but is primarily a photograph with narrative, classify as narrative_visual, NOT graphic_composition.
- If an image shows a UI with 3D elements, the UI dominates → interactive_ui.
- If an image shows a building exterior/interior with people as small elements → spatial, NOT character.
- Fashion/costume shots where the person IS the display → character.
- Sports/action photography with dramatic movement → dynamic_rhythm.

Respond ONLY in valid JSON:
{"familyKey": "one_of_the_six_keys_above", "confidence": 0.0_to_1.0, "detectedDomain": "brief specific domain description", "reasoning": "one sentence explaining why this family was chosen"}`;

// ---------------------------------------------------------------------------
// Family-specific evaluation prompt builder (same as evaluate route)
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
  rules: { ruleContent: string; ruleType: string; dimension: string | null }[],
  language: 'zh' | 'en' = 'en'
): string {
  const criteria = JSON.parse(criteriaJson) as {
    dimensions: CriterionDimension[];
  };
  const dimensionsList = criteria.dimensions
    .map((d, i) => `${i + 1}. ${d.key} (${d.name}): ${d.desc}`)
    .join('\n');

  // Build rule context if there are active rules
  let ruleContext = '';
  if (rules.length > 0) {
    const positiveRules = rules.filter((r) => r.ruleType === 'positive');
    const negativeRules = rules.filter((r) => r.ruleType === 'negative');
    const conditionalRules = rules.filter((r) => r.ruleType === 'conditional');

    if (positiveRules.length > 0) {
      ruleContext += `\n\nPositive rules (qualities to look for):\n${positiveRules.map((r) => `- ${r.ruleContent}`).join('\n')}`;
    }
    if (negativeRules.length > 0) {
      ruleContext += `\n\nNegative rules (pitfalls to watch for):\n${negativeRules.map((r) => `- ${r.ruleContent}`).join('\n')}`;
    }
    if (conditionalRules.length > 0) {
      ruleContext += `\n\nConditional rules (context-dependent considerations):\n${conditionalRules.map((r) => `- ${r.ruleContent}`).join('\n')}`;
    }
  }

  const familyNameMap: Record<string, string> = {
    narrative_visual: 'Cinematic/Visual Narrative',
    interactive_ui: 'UI/Interface Design',
    spatial: 'Spatial/Environmental Design',
    character: 'Character/Figure Design',
    graphic_composition: 'Graphic/Print Composition',
    dynamic_rhythm: 'Dynamic/Motion Design',
  };

  const langInstruction =
    language === 'zh'
      ? `重要：你必须用中文撰写所有文本内容（维度评注、优势、不足、建议、综合评估）。JSON的键名保持英文，但所有值（字符串内容）必须使用中文。`
      : `Write all text content in English.`;

  const jsonExample =
    language === 'zh'
      ? `{
  "dimensionScores": {${criteria.dimensions.map((d) => `"${d.key}": 0`).join(', ')}},
  "dimensionNotes": {${criteria.dimensions.map((d) => `"${d.key}": "中文简要评注"`).join(', ')}},
  "overallScore": 0.0,
  "strengths": ["中文优势1", "中文优势2", "中文优势3"],
  "weaknesses": ["中文不足1", "中文不足2"],
  "suggestions": ["中文具体建议1", "中文具体建议2", "中文具体建议3"],
  "evaluation": "中文综合评估段落，涵盖整体审美质量、显著元素和改进方向。"
}`
      : `{
  "dimensionScores": {${criteria.dimensions.map((d) => `"${d.key}": 0`).join(', ')}},
  "dimensionNotes": {${criteria.dimensions.map((d) => `"${d.key}": "brief note"`).join(', ')}},
  "overallScore": 0.0,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2", "specific actionable suggestion 3"],
  "evaluation": "A detailed natural language assessment paragraph covering the overall aesthetic quality, notable elements, and areas for improvement."
}`;

  return `You are an expert aesthetic evaluator specializing in ${familyNameMap[familyKey] || familyName}. 
${familyDescription}

${langInstruction}

Evaluate this image on these 5 dimensions (score each 0-10, where 0 is terrible and 10 is masterful):
${dimensionsList}
${ruleContext}

For each dimension, provide a score and brief justification. Then provide an overall assessment.

Respond ONLY in valid JSON format:
${jsonExample}

Be specific, insightful, and constructive. Avoid generic praise. Focus on observable visual qualities.`;
}

// ---------------------------------------------------------------------------
// Internal Evaluation Function
// ---------------------------------------------------------------------------

export async function evaluateImageInternal(params: {
  imageBase64: string;
  familyKey?: string; // if null, auto-classify
  language?: 'zh' | 'en';
  /** When true, always verify the provided familyKey with VLM classification */
  reclassify?: boolean;
}): Promise<InternalEvalResult> {
  const { imageBase64, familyKey: familyKeyParam, language = 'en', reclassify = false } = params;

  try {
    // ---- Initialize AI provider ----
    const ai = await getAIProvider();

    // ---- Step 1: Classify the image domain ----
    let familyKey: string;
    let detectedDomain: string | null = null;
    let domainConfidence = 0;
    let reclassified = false;

    if (familyKeyParam && !reclassify) {
      // Validate the provided familyKey without VLM verification
      const family = await db.aestheticFamily.findUnique({
        where: { key: familyKeyParam },
      });
      if (!family) {
        return {
          evaluationId: '',
          familyKey: familyKeyParam,
          familyId: '',
          overallScore: 0,
          dimensionScores: {},
          evaluation: '',
          strengths: [],
          weaknesses: [],
          suggestions: [],
          error: `Invalid familyKey: ${familyKeyParam}`,
        };
      }
      familyKey = familyKeyParam;
    } else {
      // Auto-classify using VLM (either no familyKey provided, or reclassify=true)
      const classificationResponse = await ai.visionChat({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: CLASSIFICATION_PROMPT },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
      });

      const classificationText = classificationResponse.content;
      const classificationResult = parseVLMJson<{
        familyKey: string;
        confidence: number;
        detectedDomain: string;
        reasoning?: string;
      }>(classificationText);

      if (!classificationResult || !classificationResult.familyKey) {
        return {
          evaluationId: '',
          familyKey: '',
          familyId: '',
          overallScore: 0,
          dimensionScores: {},
          evaluation: '',
          strengths: [],
          weaknesses: [],
          suggestions: [],
          error: 'Failed to classify image domain',
        };
      }

      // Validate the classified key exists
      const validKeys = [
        'narrative_visual',
        'interactive_ui',
        'spatial',
        'character',
        'graphic_composition',
        'dynamic_rhythm',
      ];
      if (!validKeys.includes(classificationResult.familyKey)) {
        return {
          evaluationId: '',
          familyKey: classificationResult.familyKey,
          familyId: '',
          overallScore: 0,
          dimensionScores: {},
          evaluation: '',
          strengths: [],
          weaknesses: [],
          suggestions: [],
          error: `Classified to unknown family: ${classificationResult.familyKey}`,
        };
      }

      // If reclassify mode and VLM disagrees with the original familyKey,
      // use the VLM's classification instead
      if (reclassify && familyKeyParam && classificationResult.familyKey !== familyKeyParam) {
        console.log(
          `[evaluate] Reclassifying: ${familyKeyParam} → ${classificationResult.familyKey} (confidence: ${classificationResult.confidence}, reasoning: ${classificationResult.reasoning || 'N/A'})`
        );
        reclassified = true;
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
          where: { status: 'active' },
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (!family) {
      return {
        evaluationId: '',
        familyKey,
        familyId: '',
        overallScore: 0,
        dimensionScores: {},
        evaluation: '',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        error: `Family not found: ${familyKey}`,
      };
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
      })),
      language
    );

    const evaluationResponse = await ai.visionChat({
      messages: [
        {
          role: 'system',
          content:
            'You are a world-class aesthetic evaluator. Always respond with valid JSON only. No markdown, no extra text.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: evaluationPrompt },
            { type: 'image_url', image_url: { url: imageBase64 } },
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
    }

    const evaluationResult = parseVLMJson<EvaluationResult>(evaluationText);

    if (!evaluationResult || !evaluationResult.dimensionScores) {
      return {
        evaluationId: '',
        familyKey,
        familyId: family.id,
        overallScore: 0,
        dimensionScores: {},
        evaluation: '',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        error: 'Failed to parse evaluation results from AI model',
      };
    }

    // ---- Step 4: Determine evolution generation ----
    const latestEvaluation = await db.aestheticEvaluation.findFirst({
      where: { familyId: family.id },
      orderBy: { evolutionGeneration: 'desc' },
      select: { evolutionGeneration: true },
    });
    const currentGeneration = (latestEvaluation?.evolutionGeneration || 0) + 1;

    // Get the latest rule version
    const latestRule = await db.aestheticRule.findFirst({
      where: { familyId: family.id },
      orderBy: { generation: 'desc' },
      select: { generation: true },
    });
    const ruleVersionUsed = latestRule
      ? `gen-${latestRule.generation}`
      : null;

    // ---- Step 5: Save evaluation to database ----
    const savedEvaluation = await db.aestheticEvaluation.create({
      data: {
        familyId: family.id,
        imageUrl: imageBase64,
        detectedDomain: detectedDomain,
        domainConfidence: domainConfidence,
        overallScore: evaluationResult.overallScore || 0,
        dimensionScores: JSON.stringify(evaluationResult.dimensionScores),
        dimensionNotes: JSON.stringify(evaluationResult.dimensionNotes || {}),
        evaluation: evaluationResult.evaluation || '',
        suggestions: JSON.stringify(evaluationResult.suggestions || []),
        strengths: JSON.stringify(evaluationResult.strengths || []),
        weaknesses: JSON.stringify(evaluationResult.weaknesses || []),
        evolutionGeneration: currentGeneration,
        ruleVersionUsed: ruleVersionUsed,
      },
    });

    // ---- Step 6: Update rule support/contradict counts ----
    for (const rule of family.rules) {
      if (rule.dimension) {
        const dimScore = evaluationResult.dimensionScores[rule.dimension];
        if (dimScore !== undefined) {
          const isSupporting =
            (rule.ruleType === 'positive' && dimScore >= 7) ||
            (rule.ruleType === 'negative' && dimScore <= 4);

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
            (rule.ruleType === 'positive' && dimScore <= 4) ||
            (rule.ruleType === 'negative' && dimScore >= 7)
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

    // ---- Step 7: Auto-promote candidate rules ----
    const candidateRules = await db.aestheticRule.findMany({
      where: {
        familyId: family.id,
        status: 'candidate',
        supportCount: { gte: 3 },
        confidence: { gte: 0.5 },
      },
    });

    for (const candidate of candidateRules) {
      await db.aestheticRule.update({
        where: { id: candidate.id },
        data: {
          status: 'active',
          confidence: 0.5,
        },
      });

      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: 'rule_created',
          description: `Candidate rule auto-promoted to active: "${candidate.ruleContent}"`,
          metadata: JSON.stringify({
            ruleId: candidate.id,
            action: 'auto_promote',
            previousStatus: 'candidate',
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
    return {
      evaluationId: savedEvaluation.id,
      familyKey,
      familyId: family.id,
      overallScore: evaluationResult.overallScore || 0,
      dimensionScores: evaluationResult.dimensionScores,
      evaluation: evaluationResult.evaluation || '',
      strengths: evaluationResult.strengths || [],
      weaknesses: evaluationResult.weaknesses || [],
      suggestions: evaluationResult.suggestions || [],
      detectedDomain,
      domainConfidence,
      reclassified,
      originalFamilyKey: reclassified ? familyKeyParam : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[evaluateImageInternal] Error:', error);
    return {
      evaluationId: '',
      familyKey: params.familyKey || '',
      familyId: '',
      overallScore: 0,
      dimensionScores: {},
      evaluation: '',
      strengths: [],
      weaknesses: [],
      suggestions: [],
      error: message,
    };
  }
}
