import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_CRAWL_SOURCES } from "@/lib/crawler";

// ---------------------------------------------------------------------------
// GET /api/crawl/seed — Seed default crawl sources
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    let created = 0;
    let skipped = 0;

    for (const source of DEFAULT_CRAWL_SOURCES) {
      // Check if source with same name already exists
      const existing = await db.crawlSource.findFirst({
        where: { name: source.name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.crawlSource.create({
        data: {
          name: source.name,
          type: source.type,
          familyKey: source.familyKey || null,
          query: source.query || null,
          targetUrls: source.targetUrls
            ? JSON.stringify(source.targetUrls)
            : null,
          maxItems: source.maxItems,
          config: source.config ? JSON.stringify(source.config) : null,
          status: "active",
        },
      });

      created++;
    }

    return NextResponse.json({
      data: {
        created,
        skipped,
        total: DEFAULT_CRAWL_SOURCES.length,
      },
      message:
        created > 0
          ? `Created ${created} crawl sources, skipped ${skipped} existing`
          : `All ${skipped} crawl sources already exist. No new sources created.`,
    });
  } catch (error) {
    console.error("[API /crawl/seed GET] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to seed crawl sources", details: message },
      { status: 500 }
    );
  }
}
