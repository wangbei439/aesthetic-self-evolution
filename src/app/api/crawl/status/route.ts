import { NextResponse } from "next/server";
import { getPipelineStatus } from "@/lib/crawler";

// ---------------------------------------------------------------------------
// GET /api/crawl/status — Get current pipeline status
// Returns: { isRunning, currentPhase, currentFamily, progress, lastRunAt, lastResult, error }
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const status = getPipelineStatus();

    return NextResponse.json({
      data: {
        isRunning: status.isRunning,
        currentPhase: status.currentPhase,
        currentFamily: status.currentFamily,
        progress: status.progress,
        lastRunAt: status.lastRunAt?.toISOString() ?? null,
        lastResult: status.lastResult
          ? {
              taskId: status.lastResult.taskId,
              itemsDiscovered: status.lastResult.itemsDiscovered,
              itemsEvaluated: status.lastResult.itemsEvaluated,
              itemsFailed: status.lastResult.itemsFailed,
              itemsSkipped: status.lastResult.itemsSkipped,
              evolutionTriggered: status.lastResult.evolutionTriggered,
              rulesCreated: status.lastResult.rulesCreated,
              rulesDeprecated: status.lastResult.rulesDeprecated,
              duration: status.lastResult.duration,
            }
          : null,
        error: status.error,
        rateLimited: status.rateLimited || false,
      },
    });
  } catch (error) {
    console.error("[API /crawl/status GET] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to get pipeline status", details: message },
      { status: 500 }
    );
  }
}
