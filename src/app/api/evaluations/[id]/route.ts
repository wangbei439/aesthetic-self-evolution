import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// PATCH /api/evaluations/[id] — Add human feedback to an evaluation
// Body: {
//   humanScoreOverride?: number  // 0-10, optional
//   humanFeedback?: string       // free text feedback, optional
// }
// ---------------------------------------------------------------------------

interface FeedbackBody {
  humanScoreOverride?: number;
  humanFeedback?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse request body
    const body = (await request.json()) as FeedbackBody;

    // Validate that at least one field is provided
    if (
      body.humanScoreOverride === undefined &&
      body.humanFeedback === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "At least one of 'humanScoreOverride' or 'humanFeedback' must be provided",
        },
        { status: 400 }
      );
    }

    // Validate humanScoreOverride range
    if (body.humanScoreOverride !== undefined) {
      if (
        typeof body.humanScoreOverride !== "number" ||
        body.humanScoreOverride < 0 ||
        body.humanScoreOverride > 10
      ) {
        return NextResponse.json(
          {
            error:
              "humanScoreOverride must be a number between 0 and 10",
          },
          { status: 400 }
        );
      }
    }

    // Validate humanFeedback type
    if (
      body.humanFeedback !== undefined &&
      typeof body.humanFeedback !== "string"
    ) {
      return NextResponse.json(
        { error: "humanFeedback must be a string" },
        { status: 400 }
      );
    }

    // Check if the evaluation exists
    const existingEvaluation = await db.aestheticEvaluation.findUnique({
      where: { id },
    });

    if (!existingEvaluation) {
      return NextResponse.json(
        { error: `Evaluation not found with id: ${id}` },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      humanScoreOverride?: number;
      humanFeedback?: string;
    } = {};

    if (body.humanScoreOverride !== undefined) {
      updateData.humanScoreOverride = body.humanScoreOverride;
    }

    if (body.humanFeedback !== undefined) {
      // Store feedback as JSON to match the schema's pattern
      // (existing evaluations use JSON for humanFeedback)
      updateData.humanFeedback = JSON.stringify({
        text: body.humanFeedback,
        timestamp: new Date().toISOString(),
      });
    }

    // Update the evaluation
    const updatedEvaluation = await db.aestheticEvaluation.update({
      where: { id },
      data: updateData,
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
    });

    // Return the updated evaluation in a consistent format
    return NextResponse.json({
      id: updatedEvaluation.id,
      family: updatedEvaluation.family,
      detectedDomain: updatedEvaluation.detectedDomain,
      domainConfidence: updatedEvaluation.domainConfidence,
      overallScore: updatedEvaluation.overallScore,
      dimensionScores: JSON.parse(updatedEvaluation.dimensionScores),
      evaluation: updatedEvaluation.evaluation,
      strengths: JSON.parse(updatedEvaluation.strengths),
      weaknesses: JSON.parse(updatedEvaluation.weaknesses),
      suggestions: JSON.parse(updatedEvaluation.suggestions),
      evolutionGeneration: updatedEvaluation.evolutionGeneration,
      ruleVersionUsed: updatedEvaluation.ruleVersionUsed,
      humanFeedback: updatedEvaluation.humanFeedback
        ? JSON.parse(updatedEvaluation.humanFeedback)
        : null,
      humanScoreOverride: updatedEvaluation.humanScoreOverride,
      createdAt: updatedEvaluation.createdAt,
      updatedAt: updatedEvaluation.updatedAt,
    });
  } catch (error) {
    console.error("[API /evaluations/[id] PATCH] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to update evaluation feedback", details: message },
      { status: 500 }
    );
  }
}
