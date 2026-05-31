import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/crawl/items — List crawled items with pagination
// Query params:
//   page             (optional) — page number, default 1
//   limit            (optional) — page size, default 20, max 100
//   familyKey        (optional) — filter by family key
//   evaluationStatus (optional) — filter by evaluation status
//   sourceId         (optional) — filter by source ID
//   taskId           (optional) — filter by task ID
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      100
    );
    const familyKey = searchParams.get("familyKey");
    const evaluationStatus = searchParams.get("evaluationStatus");
    const sourceId = searchParams.get("sourceId");
    const taskId = searchParams.get("taskId");

    const offset = (page - 1) * limit;

    // Validate evaluationStatus if provided
    if (evaluationStatus) {
      const validStatuses = ["pending", "evaluating", "evaluated", "failed", "skipped"];
      if (!validStatuses.includes(evaluationStatus)) {
        return NextResponse.json(
          {
            error: `Invalid evaluationStatus. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (familyKey) {
      where.familyKey = familyKey;
    }

    if (evaluationStatus) {
      where.evaluationStatus = evaluationStatus;
    }

    if (sourceId) {
      where.sourceId = sourceId;
    }

    if (taskId) {
      where.taskId = taskId;
    }

    const [items, total] = await Promise.all([
      db.crawledItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.crawledItem.count({ where }),
    ]);

    const data = items.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      taskId: item.taskId,
      imageUrl: item.imageUrl,
      title: item.title,
      sourceUrl: item.sourceUrl,
      description: item.description,
      familyKey: item.familyKey,
      familyId: item.familyId,
      classificationConfidence: item.classificationConfidence,
      evaluationStatus: item.evaluationStatus,
      evaluationId: item.evaluationId,
      overallScore: item.overallScore,
      imageHash: item.imageHash,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
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
    console.error("[API /crawl/items GET] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch crawled items", details: message },
      { status: 500 }
    );
  }
}
