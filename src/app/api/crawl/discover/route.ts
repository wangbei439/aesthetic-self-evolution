import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoverImagesForFamily } from "@/lib/crawler";

// ---------------------------------------------------------------------------
// POST /api/crawl/discover — Run discovery only (no evaluation)
// Body: { sourceId?, familyKey?, query?, maxItems? }
// ---------------------------------------------------------------------------
interface DiscoverBody {
  sourceId?: string;
  familyKey?: string;
  query?: string;
  maxItems?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DiscoverBody;

    // Validate sourceId if provided
    if (body.sourceId) {
      const source = await db.crawlSource.findUnique({
        where: { id: body.sourceId },
      });
      if (!source) {
        return NextResponse.json(
          { error: `Crawl source not found with id: ${body.sourceId}` },
          { status: 404 }
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

    // Determine familyKey — use source's familyKey if not provided
    let familyKey = body.familyKey;
    if (!familyKey && body.sourceId) {
      const source = await db.crawlSource.findUnique({
        where: { id: body.sourceId },
      });
      if (source?.familyKey) {
        familyKey = source.familyKey;
      }
    }

    if (!familyKey) {
      return NextResponse.json(
        { error: "familyKey is required (either directly or via sourceId with a family-specific source)" },
        { status: 400 }
      );
    }

    // Determine query — use source's query if not provided
    let query = body.query;
    if (!query && body.sourceId) {
      const source = await db.crawlSource.findUnique({
        where: { id: body.sourceId },
      });
      if (source?.query) {
        query = source.query;
      }
    }

    const maxItems = body.maxItems || 10;

    // Run discovery using the existing crawler function
    const discovered = await discoverImagesForFamily(
      familyKey,
      query || undefined,
      maxItems
    );

    // Create CrawledItem records for discovered images
    const createdItems = [];
    for (const img of discovered) {
      try {
        // Check for duplicates
        const existing = await db.crawledItem.findFirst({
          where: { imageUrl: img.imageUrl },
        });
        if (existing) continue;

        const family = await db.aestheticFamily.findUnique({
          where: { key: img.familyKey || familyKey! },
          select: { id: true },
        });

        const item = await db.crawledItem.create({
          data: {
            sourceId: body.sourceId || null,
            imageUrl: img.imageUrl,
            title: img.title || null,
            sourceUrl: img.sourceUrl || null,
            description: img.description || null,
            familyKey: img.familyKey || familyKey || null,
            familyId: family?.id || null,
            evaluationStatus: "pending",
          },
        });
        createdItems.push(item);
      } catch {
        // Skip duplicate or invalid items
      }
    }

    // Update source stats if sourceId was provided
    if (body.sourceId) {
      await db.crawlSource.update({
        where: { id: body.sourceId },
        data: {
          totalFound: { increment: discovered.length },
          lastCrawledAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      data: {
        discovered: discovered.map((img) => ({
          imageUrl: img.imageUrl,
          title: img.title,
          sourceUrl: img.sourceUrl,
          description: img.description,
          familyKey: img.familyKey,
        })),
        itemsCreated: createdItems.length,
      },
      message: `Discovered ${discovered.length} images, created ${createdItems.length} crawl items`,
    });
  } catch (error) {
    console.error("[API /crawl/discover POST] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to run discovery", details: message },
      { status: 500 }
    );
  }
}
