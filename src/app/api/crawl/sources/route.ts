import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/crawl/sources — List all crawl sources with stats
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const sources = await db.crawlSource.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            tasks: true,
            items: true,
          },
        },
      },
    });

    const data = sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      familyKey: source.familyKey,
      query: source.query,
      targetUrls: source.targetUrls,
      maxItems: source.maxItems,
      config: source.config,
      status: source.status,
      lastCrawledAt: source.lastCrawledAt,
      totalFound: source.totalFound,
      totalEvaluated: source.totalEvaluated,
      taskCount: source._count.tasks,
      itemCount: source._count.items,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    }));

    return NextResponse.json({
      data,
      total: sources.length,
    });
  } catch (error) {
    console.error("[API /crawl/sources GET] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch crawl sources", details: message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/crawl/sources — Create a new crawl source
// Body: { name, type, familyKey?, query?, targetUrls?, maxItems?, config? }
// ---------------------------------------------------------------------------
interface CreateSourceBody {
  name: string;
  type: string;
  familyKey?: string;
  query?: string;
  targetUrls?: string[];
  maxItems?: number;
  config?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSourceBody;

    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: "Missing required fields: name and type" },
        { status: 400 }
      );
    }

    const validTypes = ["search", "gallery", "rss", "custom"];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        {
          error: `Invalid type: ${body.type}. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
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

    const source = await db.crawlSource.create({
      data: {
        name: body.name,
        type: body.type,
        familyKey: body.familyKey || null,
        query: body.query || null,
        targetUrls: body.targetUrls ? JSON.stringify(body.targetUrls) : null,
        maxItems: body.maxItems || 10,
        config: body.config ? JSON.stringify(body.config) : null,
        status: "active",
      },
    });

    return NextResponse.json(
      {
        data: {
          id: source.id,
          name: source.name,
          type: source.type,
          familyKey: source.familyKey,
          query: source.query,
          targetUrls: source.targetUrls,
          maxItems: source.maxItems,
          config: source.config,
          status: source.status,
          createdAt: source.createdAt,
        },
        message: "Crawl source created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API /crawl/sources POST] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to create crawl source", details: message },
      { status: 500 }
    );
  }
}
