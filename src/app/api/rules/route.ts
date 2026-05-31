import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/rules — List rules with filtering and pagination
// Query params:
//   familyKey  (optional) — filter by family key
//   status     (optional) — filter by status (active, candidate, deprecated)
//   ruleType   (optional) — filter by rule type (positive, negative, conditional)
//   sourceType (optional) — filter by source type (seed, evolved, human, transferred)
//   search     (optional) — search rule content (case-insensitive contains)
//   limit      (optional) — page size, default 20, max 100
//   offset     (optional) — skip count, default 0
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const familyKey = searchParams.get("familyKey");
    const status = searchParams.get("status");
    const ruleType = searchParams.get("ruleType");
    const sourceType = searchParams.get("sourceType");
    const search = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    // Parse and validate pagination
    const limit = Math.min(
      Math.max(parseInt(limitParam || "20", 10) || 20, 1),
      100
    );
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // Validate status if provided
    if (status && !["active", "candidate", "deprecated"].includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status filter. Must be one of: active, candidate, deprecated",
        },
        { status: 400 }
      );
    }

    // Validate ruleType if provided
    if (ruleType && !["positive", "negative", "conditional"].includes(ruleType)) {
      return NextResponse.json(
        {
          error:
            "Invalid ruleType filter. Must be one of: positive, negative, conditional",
        },
        { status: 400 }
      );
    }

    // Validate sourceType if provided
    if (sourceType && !["seed", "evolved", "human", "transferred"].includes(sourceType)) {
      return NextResponse.json(
        {
          error:
            "Invalid sourceType filter. Must be one of: seed, evolved, human, transferred",
        },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (ruleType) {
      where.ruleType = ruleType;
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    if (search) {
      where.ruleContent = { contains: search };
    }

    if (familyKey) {
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

    // Fetch rules with family info
    const [rules, total] = await Promise.all([
      db.aestheticRule.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
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
      db.aestheticRule.count({ where }),
    ]);

    // Format response
    const formatted = rules.map((rule) => ({
      id: rule.id,
      family: rule.family,
      ruleContent: rule.ruleContent,
      ruleType: rule.ruleType,
      dimension: rule.dimension,
      priority: rule.priority,
      generation: rule.generation,
      parentId: rule.parentId,
      sourceType: rule.sourceType,
      sourceFamilyId: rule.sourceFamilyId,
      supportCount: rule.supportCount,
      contradictCount: rule.contradictCount,
      confidence: rule.confidence,
      status: rule.status,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));

    return NextResponse.json({
      rules: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[API /rules GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/rules — Manage rule lifecycle
// Body: {
//   ruleId: string
//   action: "promote" | "deprecate" | "delete" | "restore"
// }
// ---------------------------------------------------------------------------
interface RuleActionBody {
  ruleId: string;
  action: "promote" | "deprecate" | "delete" | "restore";
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as RuleActionBody;

    if (!body.ruleId || !body.action) {
      return NextResponse.json(
        { error: "Missing required fields: ruleId and action" },
        { status: 400 }
      );
    }

    const validActions = ["promote", "deprecate", "delete", "restore"];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        {
          error: `Invalid action: ${body.action}. Must be one of: ${validActions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Fetch the rule
    const rule = await db.aestheticRule.findUnique({
      where: { id: body.ruleId },
      include: {
        family: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: `Rule not found with id: ${body.ruleId}` },
        { status: 404 }
      );
    }

    switch (body.action) {
      case "promote": {
        // Only candidate rules can be promoted
        if (rule.status !== "candidate") {
          return NextResponse.json(
            {
              error: `Cannot promote rule with status '${rule.status}'. Only 'candidate' rules can be promoted.`,
              currentStatus: rule.status,
            },
            { status: 400 }
          );
        }

        const updatedRule = await db.aestheticRule.update({
          where: { id: body.ruleId },
          data: {
            status: "active",
            confidence: 0.5,
          },
        });

        // Create evolution event for promotion
        await db.evolutionEvent.create({
          data: {
            familyId: rule.familyId,
            eventType: "rule_created",
            description: `Candidate rule promoted to active: "${rule.ruleContent}"`,
            metadata: JSON.stringify({
              ruleId: rule.id,
              action: "promote",
              previousStatus: "candidate",
              previousConfidence: rule.confidence,
              newConfidence: 0.5,
            }),
            generation: rule.generation,
          },
        });

        return NextResponse.json({
          message: "Rule promoted from candidate to active",
          rule: {
            id: updatedRule.id,
            ruleContent: updatedRule.ruleContent,
            ruleType: updatedRule.ruleType,
            status: updatedRule.status,
            confidence: updatedRule.confidence,
            family: rule.family,
          },
        });
      }

      case "deprecate": {
        // Any rule can be deprecated
        if (rule.status === "deprecated") {
          return NextResponse.json(
            { error: "Rule is already deprecated", currentStatus: rule.status },
            { status: 400 }
          );
        }

        const updatedRule = await db.aestheticRule.update({
          where: { id: body.ruleId },
          data: { status: "deprecated" },
        });

        // Create evolution event for deprecation
        await db.evolutionEvent.create({
          data: {
            familyId: rule.familyId,
            eventType: "rule_deprecated",
            description: `Rule deprecated: "${rule.ruleContent}"`,
            metadata: JSON.stringify({
              ruleId: rule.id,
              action: "deprecate",
              previousStatus: rule.status,
              previousConfidence: rule.confidence,
              supportCount: rule.supportCount,
              contradictCount: rule.contradictCount,
            }),
            generation: rule.generation,
          },
        });

        return NextResponse.json({
          message: `Rule deprecated (was ${rule.status})`,
          rule: {
            id: updatedRule.id,
            ruleContent: updatedRule.ruleContent,
            ruleType: updatedRule.ruleType,
            status: updatedRule.status,
            confidence: updatedRule.confidence,
            family: rule.family,
          },
        });
      }

      case "restore": {
        // Only deprecated rules can be restored
        if (rule.status !== "deprecated") {
          return NextResponse.json(
            {
              error: `Cannot restore rule with status '${rule.status}'. Only 'deprecated' rules can be restored.`,
              currentStatus: rule.status,
            },
            { status: 400 }
          );
        }

        const updatedRule = await db.aestheticRule.update({
          where: { id: body.ruleId },
          data: {
            status: "candidate",
          },
        });

        // Create evolution event for restore
        await db.evolutionEvent.create({
          data: {
            familyId: rule.familyId,
            eventType: "rule_created",
            description: `Deprecated rule restored to candidate: "${rule.ruleContent}"`,
            metadata: JSON.stringify({
              ruleId: rule.id,
              action: "restore",
              previousStatus: "deprecated",
              previousConfidence: rule.confidence,
            }),
            generation: rule.generation,
          },
        });

        return NextResponse.json({
          message: "Rule restored from deprecated to candidate",
          rule: {
            id: updatedRule.id,
            ruleContent: updatedRule.ruleContent,
            ruleType: updatedRule.ruleType,
            status: updatedRule.status,
            confidence: updatedRule.confidence,
            family: rule.family,
          },
        });
      }

      case "delete": {
        // Actually delete the rule
        await db.aestheticRule.delete({
          where: { id: body.ruleId },
        });

        // Create evolution event for deletion
        await db.evolutionEvent.create({
          data: {
            familyId: rule.familyId,
            eventType: "rule_deprecated",
            description: `Rule deleted: "${rule.ruleContent}"`,
            metadata: JSON.stringify({
              ruleId: rule.id,
              action: "delete",
              previousStatus: rule.status,
              ruleContent: rule.ruleContent,
              ruleType: rule.ruleType,
              confidence: rule.confidence,
              supportCount: rule.supportCount,
              contradictCount: rule.contradictCount,
            }),
            generation: rule.generation,
          },
        });

        return NextResponse.json({
          message: "Rule deleted",
          deletedRule: {
            id: rule.id,
            ruleContent: rule.ruleContent,
            ruleType: rule.ruleType,
            previousStatus: rule.status,
            family: rule.family,
          },
        });
      }
    }
  } catch (error) {
    console.error("[API /rules PATCH] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to manage rule", details: message },
      { status: 500 }
    );
  }
}
