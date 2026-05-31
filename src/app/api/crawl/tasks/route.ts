import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/crawl/tasks — List crawl tasks with pagination
// Query params:
//   page     (optional) — page number, default 1
//   limit    (optional) — page size, default 20, max 100
//   sourceId (optional) — filter by source ID
//   status   (optional) — filter by status
//   trigger  (optional) — filter by trigger type
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      100
    );
    const sourceId = searchParams.get("sourceId");
    const status = searchParams.get("status");
    const trigger = searchParams.get("trigger");

    const offset = (page - 1) * limit;

    // Validate status if provided
    if (status) {
      const validStatuses = ["pending", "running", "completed", "failed"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate trigger if provided
    if (trigger) {
      const validTriggers = ["manual", "scheduled", "auto_evolve"];
      if (!validTriggers.includes(trigger)) {
        return NextResponse.json(
          {
            error: `Invalid trigger. Must be one of: ${validTriggers.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (sourceId) {
      where.sourceId = sourceId;
    }

    if (status) {
      where.status = status;
    }

    if (trigger) {
      where.trigger = trigger;
    }

    const [tasks, total] = await Promise.all([
      db.crawlTask.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          source: {
            select: {
              id: true,
              name: true,
              type: true,
              familyKey: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      db.crawlTask.count({ where }),
    ]);

    const data = tasks.map((task) => ({
      id: task.id,
      sourceId: task.sourceId,
      source: task.source,
      status: task.status,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      itemsFound: task.itemsFound,
      itemsEvaluated: task.itemsEvaluated,
      itemsSkipped: task.itemsSkipped,
      itemsFailed: task.itemsFailed,
      error: task.error,
      trigger: task.trigger,
      evolutionTriggered: task.evolutionTriggered,
      rulesCreated: task.rulesCreated,
      rulesDeprecated: task.rulesDeprecated,
      itemCount: task._count.items,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error("[API /crawl/tasks GET] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch crawl tasks", details: message },
      { status: 500 }
    );
  }
}
