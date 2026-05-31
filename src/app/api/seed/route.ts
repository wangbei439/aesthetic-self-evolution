import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Seed rules data: expert knowledge bootstrap for each aesthetic family
// ---------------------------------------------------------------------------
interface SeedRule {
  ruleContent: string;
  ruleType: "positive" | "negative" | "conditional";
  priority: number;
}

const SEED_RULES: Record<string, SeedRule[]> = {
  narrative_visual: [
    {
      ruleContent:
        "强构图引导：画面应有明确的主视觉焦点和视觉动线，引导观众视线自然流动",
      ruleType: "positive",
      priority: 0.9,
    },
    {
      ruleContent:
        "光影叙事：光影不仅照亮场景，更应传递情绪——高对比硬光暗示冲突，柔光暗示宁静",
      ruleType: "positive",
      priority: 0.8,
    },
    {
      ruleContent:
        "避免视觉噪音：画面中不应出现与叙事无关的杂乱元素，每个元素都应服务于故事",
      ruleType: "negative",
      priority: 0.7,
    },
    {
      ruleContent:
        "色调一致性：当画面属于同一场景/段落时，色调应保持情绪统一，避免不协调的色温跳跃",
      ruleType: "conditional",
      priority: 0.6,
    },
    {
      ruleContent:
        "三分法与突破：构图遵循三分法但敢于在关键帧突破，制造视觉张力",
      ruleType: "positive",
      priority: 0.5,
    },
  ],

  interactive_ui: [
    {
      ruleContent:
        "视觉层次分明：核心操作按钮 > 次要功能 > 辅助信息，三级层次一眼可辨",
      ruleType: "positive",
      priority: 0.9,
    },
    {
      ruleContent:
        "避免间距不均：相同性质的元素间距必须一致，不一致的间距暗示不同层级关系",
      ruleType: "negative",
      priority: 0.8,
    },
    {
      ruleContent:
        "色彩有语义：主色用于可交互元素，灰色用于不可交互，红色用于破坏性操作",
      ruleType: "positive",
      priority: 0.7,
    },
    {
      ruleContent:
        "字体层级不超过3级：标题、正文、辅助文字三个层级足够，过多字号制造视觉混乱",
      ruleType: "conditional",
      priority: 0.6,
    },
    {
      ruleContent:
        "避免纯装饰性元素：界面中每个视觉元素都应有功能目的，纯装饰元素分散注意力",
      ruleType: "negative",
      priority: 0.5,
    },
  ],

  spatial: [
    {
      ruleContent:
        "纵深层次感：前景-中景-远景三层构建空间深度，避免扁平化场景",
      ruleType: "positive",
      priority: 0.9,
    },
    {
      ruleContent:
        "氛围先于细节：整体氛围（雾、光、色调）比细节堆砌更能营造沉浸感",
      ruleType: "positive",
      priority: 0.8,
    },
    {
      ruleContent:
        "避免尺度失调：场景中物体比例关系必须一致，比例错误会破坏空间真实感",
      ruleType: "negative",
      priority: 0.7,
    },
    {
      ruleContent:
        "当场景偏写实风格时，材质精度需要匹配观察距离——近处精远处简",
      ruleType: "conditional",
      priority: 0.6,
    },
    {
      ruleContent:
        "视觉锚点：空间中应有一个自然的视觉锚点（门、光源、标志物）引导探索方向",
      ruleType: "positive",
      priority: 0.5,
    },
  ],

  character: [
    {
      ruleContent:
        "剪影辨识度：角色剪影应具有独特辨识度，仅凭轮廓即可区分角色",
      ruleType: "positive",
      priority: 0.9,
    },
    {
      ruleContent:
        "材质可信度：不同材质（金属、布料、皮肤）应有明确的质感差异表现",
      ruleType: "positive",
      priority: 0.8,
    },
    {
      ruleContent:
        "避免解剖结构错误：即使风格化设计，关节和肌肉的基本结构关系不应违背解剖逻辑",
      ruleType: "negative",
      priority: 0.7,
    },
    {
      ruleContent:
        "风格化程度需统一：同一角色设计中的风格化程度应保持一致，不可半写实半Q版",
      ruleType: "conditional",
      priority: 0.6,
    },
    {
      ruleContent:
        "动态线条：角色轮廓应含有动势线，暗示运动趋势和能量方向",
      ruleType: "positive",
      priority: 0.5,
    },
  ],

  graphic_composition: [
    {
      ruleContent:
        "视觉重心明确：画面应有明确的视觉重心，观者视线自然落在核心元素上",
      ruleType: "positive",
      priority: 0.9,
    },
    {
      ruleContent:
        "负空间呼吸：留白不是空白，而是给核心元素呼吸空间，强化视觉冲击",
      ruleType: "positive",
      priority: 0.8,
    },
    {
      ruleContent:
        "避免元素拥挤：画面元素之间必须留有足够间距，拥挤的画面无法传递重点",
      ruleType: "negative",
      priority: 0.7,
    },
    {
      ruleContent:
        "色彩数量控制：主色+辅助色+强调色不超过3种色系，多色系需有统一的色调倾向",
      ruleType: "conditional",
      priority: 0.6,
    },
    {
      ruleContent:
        "对齐与网格：元素排布应遵循网格系统，有意识的打破比无意识的混乱更有力",
      ruleType: "positive",
      priority: 0.5,
    },
  ],

  dynamic_rhythm: [
    {
      ruleContent:
        "缓急对比：运动节奏应有加速和减速的对比，匀速运动缺乏生命力",
      ruleType: "positive",
      priority: 0.9,
    },
    {
      ruleContent:
        "能量弧线：运动轨迹应呈弧线而非直线，弧线运动更自然更有韵律感",
      ruleType: "positive",
      priority: 0.8,
    },
    {
      ruleContent:
        "避免生硬切变：运动状态切换不应突兀，需有预备动作和缓冲过渡",
      ruleType: "negative",
      priority: 0.7,
    },
    {
      ruleContent:
        "当动效用于界面时，功能反馈的动效应快于装饰性动效，确保操作响应感",
      ruleType: "conditional",
      priority: 0.6,
    },
    {
      ruleContent:
        "视觉预备：重要动作前应有微小的预备动作（蓄力/回拉），增强冲击力",
      ruleType: "positive",
      priority: 0.5,
    },
  ],
};

// ---------------------------------------------------------------------------
// GET /api/seed — Seed initial aesthetic rules for each family
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    let totalCreated = 0;
    const familyResults: Record<
      string,
      { created: number; skipped: boolean }
    > = {};

    // Fetch all families
    const families = await db.aestheticFamily.findMany();

    if (families.length === 0) {
      return NextResponse.json(
        {
          error:
            "No aesthetic families found. Please seed families first via /api/families.",
          rulesCreated: 0,
        },
        { status: 400 }
      );
    }

    for (const family of families) {
      const seedRules = SEED_RULES[family.key];

      if (!seedRules) {
        familyResults[family.key] = { created: 0, skipped: true };
        continue;
      }

      // Check if rules already exist for this family
      const existingCount = await db.aestheticRule.count({
        where: { familyId: family.id },
      });

      if (existingCount > 0) {
        familyResults[family.key] = { created: 0, skipped: true };
        continue;
      }

      // Create seed rules for this family
      let created = 0;
      for (const rule of seedRules) {
        await db.aestheticRule.create({
          data: {
            familyId: family.id,
            ruleContent: rule.ruleContent,
            ruleType: rule.ruleType,
            priority: rule.priority,
            generation: 1,
            sourceType: "seed",
            status: "active",
            confidence: 0.7,
          },
        });
        created++;
      }

      totalCreated += created;
      familyResults[family.key] = { created, skipped: false };

      // Create evolution event for seeding
      await db.evolutionEvent.create({
        data: {
          familyId: family.id,
          eventType: "rule_created",
          description: `Seeded ${created} expert knowledge rules for ${family.name}`,
          metadata: JSON.stringify({
            sourceType: "seed",
            ruleCount: created,
            ruleTypes: seedRules.map((r) => r.ruleType),
          }),
          generation: 1,
        },
      });
    }

    return NextResponse.json({
      rulesCreated: totalCreated,
      families: familyResults,
      message:
        totalCreated > 0
          ? `Successfully seeded ${totalCreated} expert rules across ${Object.values(familyResults).filter((r) => r.created > 0).length} families`
          : "All families already have rules. No new rules were created.",
    });
  } catch (error) {
    console.error("[API /seed] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to seed rules", details: message },
      { status: 500 }
    );
  }
}
