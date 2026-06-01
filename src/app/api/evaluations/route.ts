import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Safe JSON parse helper
// ---------------------------------------------------------------------------
function safeJsonParse(str: string | null | undefined, fallback: unknown = null) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// GET /api/evaluations — Paginated evaluation history
// Query params:
//   familyId  (optional) — filter by family ID
//   familyKey (optional) — filter by family key (alternative to familyId)
//   limit     (optional) — page size, default 20, max 100
//   offset    (optional) — skip count, default 0
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const familyId = searchParams.get("familyId");
    const familyKey = searchParams.get("familyKey");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    // Parse and validate pagination
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // Build where clause
    const where: Record<string, unknown> = {};

    if (familyId) {
      where.familyId = familyId;
    } else if (familyKey) {
      // Resolve familyKey to familyId
      const family = await db.aestheticFamily.findUnique({
        where: { key: familyKey },
        select: { id: true },
      });
      if (!family) {
        return NextResponse.json(
          { error: `Family not found with key: ${familyKey}` },
          { status: 404 }
        );
      }
      where.familyId = family.id;
    }

    // Fetch evaluations with family info
    const [evaluations, total] = await Promise.all([
      db.aestheticEvaluation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          family: {
            select: {
              id: true,
              key: true,
              name: true,
              icon: true,
              color: true,
            },
          },
        },
      }),
      db.aestheticEvaluation.count({ where }),
    ]);

    // Format response
    const formatted = evaluations.map((e) => ({
      id: e.id,
      family: e.family,
      detectedDomain: e.detectedDomain,
      domainConfidence: e.domainConfidence,
      overallScore: e.overallScore,
      dimensionScores: safeJsonParse(e.dimensionScores, {}),
      dimensionNotes: safeJsonParse(e.dimensionNotes, {}),
      evaluation: e.evaluation,
      strengths: safeJsonParse(e.strengths, []),
      weaknesses: safeJsonParse(e.weaknesses, []),
      suggestions: safeJsonParse(e.suggestions, []),
      evolutionGeneration: e.evolutionGeneration,
      ruleVersionUsed: e.ruleVersionUsed,
      humanFeedback: safeJsonParse(e.humanFeedback),
      humanScoreOverride: e.humanScoreOverride,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return NextResponse.json({
      evaluations: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[API /evaluations] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation history" },
      { status: 500 }
    );
  }
}
