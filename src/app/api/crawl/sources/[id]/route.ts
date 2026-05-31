import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// PATCH /api/crawl/sources/[id] — Update source
// Body: { name?, type?, familyKey?, query?, targetUrls?, maxItems?, config?, status? }
// ---------------------------------------------------------------------------
interface UpdateSourceBody {
  name?: string;
  type?: string;
  familyKey?: string | null;
  query?: string | null;
  targetUrls?: string[] | null;
  maxItems?: number;
  config?: Record<string, unknown> | null;
  status?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateSourceBody;

    // Check if source exists
    const existing = await db.crawlSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: `Crawl source not found with id: ${id}` },
        { status: 404 }
      );
    }

    // Validate type if provided
    if (body.type) {
      const validTypes = ["search", "gallery", "rss", "custom"];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          {
            error: `Invalid type: ${body.type}. Must be one of: ${validTypes.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ["active", "paused", "error"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Invalid status: ${body.status}. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate familyKey if provided
    if (body.familyKey) {
      const family = await db.aestheticFamily.findUnique({
        where: { key: body.familyKey },
      });
      if (!family) {
        return NextResponse.json(
          { error: `Family not found with key: ${body.familyKey}` },
          { status: 404 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.familyKey !== undefined) updateData.familyKey = body.familyKey;
    if (body.query !== undefined) updateData.query = body.query;
    if (body.targetUrls !== undefined) {
      updateData.targetUrls = body.targetUrls
        ? JSON.stringify(body.targetUrls)
        : null;
    }
    if (body.maxItems !== undefined) updateData.maxItems = body.maxItems;
    if (body.config !== undefined) {
      updateData.config = body.config ? JSON.stringify(body.config) : null;
    }
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await db.crawlSource.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        familyKey: updated.familyKey,
        query: updated.query,
        targetUrls: updated.targetUrls,
        maxItems: updated.maxItems,
        config: updated.config,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
      message: "Crawl source updated successfully",
    });
  } catch (error) {
    console.error("[API /crawl/sources/[id] PATCH] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to update crawl source", details: message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crawl/sources/[id] — Delete source
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if source exists
    const existing = await db.crawlSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tasks: true, items: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Crawl source not found with id: ${id}` },
        { status: 404 }
      );
    }

    // Delete the source (cascading handled by DB or manual cleanup)
    await db.crawlSource.delete({ where: { id } });

    return NextResponse.json({
      data: {
        id: existing.id,
        name: existing.name,
        deletedTasks: existing._count.tasks,
        deletedItems: existing._count.items,
      },
      message: "Crawl source deleted successfully",
    });
  } catch (error) {
    console.error("[API /crawl/sources/[id] DELETE] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to delete crawl source", details: message },
      { status: 500 }
    );
  }
}
