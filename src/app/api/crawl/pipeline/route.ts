import { NextResponse } from "next/server";
import { runPipeline, getPipelineStatus } from "@/lib/crawler";

// ---------------------------------------------------------------------------
// POST /api/crawl/pipeline — Run full auto-evolution pipeline
// Body: { familyKey?, sourceId?, maxItemsPerFamily?, triggerEvolution?, language?, trigger? }
// ---------------------------------------------------------------------------
interface PipelineBody {
  familyKey?: string;
  sourceId?: string;
  maxItemsPerFamily?: number;
  triggerEvolution?: boolean;
  language?: "zh" | "en";
  trigger?: "manual" | "scheduled" | "auto_evolve";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PipelineBody;

    // Check if pipeline is already running
    const currentStatus = getPipelineStatus();
    if (currentStatus.isRunning) {
      return NextResponse.json(
        {
          error: "Pipeline is already running",
          status: {
            isRunning: currentStatus.isRunning,
            currentPhase: currentStatus.currentPhase,
            currentFamily: currentStatus.currentFamily,
            progress: currentStatus.progress,
          },
        },
        { status: 409 }
      );
    }

    // Start pipeline in background — don't await it
    runPipeline({
      familyKey: body.familyKey,
      sourceId: body.sourceId,
      maxItemsPerFamily: body.maxItemsPerFamily || 5,
      triggerEvolution: body.triggerEvolution !== false,
      language: body.language || "zh",
      trigger: body.trigger || "manual",
    }).catch((error) => {
      console.error("[Pipeline] Background pipeline error:", error);
    });

    return NextResponse.json(
      {
        data: {
          message: "Pipeline started in background",
          options: {
            familyKey: body.familyKey || "all",
            maxItemsPerFamily: body.maxItemsPerFamily || 5,
            triggerEvolution: body.triggerEvolution !== false,
            language: body.language || "zh",
            trigger: body.trigger || "manual",
          },
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[API /crawl/pipeline POST] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to start pipeline", details: message },
      { status: 500 }
    );
  }
}
