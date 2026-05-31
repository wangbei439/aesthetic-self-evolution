import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const FAMILIES_DATA = [
  {
    key: "narrative_visual",
    name: "叙事视觉",
    description:
      "通过镜头语言和视觉叙事传递情感与故事。包括影视摄影、游戏过场、动画分镜、MV等。",
    icon: "Clapperboard",
    color: "orange",
    criteria: JSON.stringify({
      dimensions: [
        { key: "composition", name: "构图", desc: "画面构图的平衡与引导力" },
        { key: "light_shadow", name: "光影", desc: "光线的戏剧性与氛围营造" },
        { key: "color_tone", name: "色调", desc: "色彩的情绪表达与统一性" },
        {
          key: "narrative_tension",
          name: "叙事张力",
          desc: "画面传递的故事感与情绪强度",
        },
        { key: "rhythm", name: "节奏感", desc: "视觉元素的流动与韵律" },
      ],
    }),
    domains: JSON.stringify([
      "影视摄影",
      "游戏过场动画",
      "动画分镜",
      "MV/音乐视频",
      "广告短片",
    ]),
  },
  {
    key: "interactive_ui",
    name: "交互界面",
    description:
      "以功能可用性为核心的美学。包括UI设计、游戏HUD、Web/App界面等。",
    icon: "Layout",
    color: "emerald",
    criteria: JSON.stringify({
      dimensions: [
        {
          key: "visual_hierarchy",
          name: "视觉层次",
          desc: "信息的主次关系与阅读动线",
        },
        {
          key: "spacing_rhythm",
          name: "间距节奏",
          desc: "元素间距的一致性与韵律感",
        },
        {
          key: "color_system",
          name: "色彩体系",
          desc: "配色的功能性与美观性",
        },
        {
          key: "typography",
          name: "字体排版",
          desc: "字体的选择与排布品质",
        },
        {
          key: "usability_beauty",
          name: "可用性之美",
          desc: "功能与美感的统一",
        },
      ],
    }),
    domains: JSON.stringify([
      "UI设计",
      "游戏HUD",
      "Web界面",
      "App界面",
      "仪表盘/数据可视化",
      "后台管理系统",
    ]),
  },
  {
    key: "spatial",
    name: "空间营造",
    description:
      "通过空间比例与氛围营造沉浸体验。包括游戏场景、建筑可视化、VR环境等。",
    icon: "Building2",
    color: "violet",
    criteria: JSON.stringify({
      dimensions: [
        {
          key: "spatial_proportion",
          name: "空间比例",
          desc: "空间尺度的协调与壮观感",
        },
        {
          key: "atmosphere",
          name: "氛围渲染",
          desc: "环境氛围的营造能力",
        },
        {
          key: "depth_layering",
          name: "纵深层次",
          desc: "前景/中景/远景的层次感",
        },
        {
          key: "immersion",
          name: "沉浸感",
          desc: "空间的代入感与真实感",
        },
        {
          key: "detail_richness",
          name: "细节丰富度",
          desc: "环境细节的精致与可信度",
        },
      ],
    }),
    domains: JSON.stringify([
      "游戏场景",
      "建筑可视化",
      "室内设计",
      "VR环境",
      "舞台设计",
      "主题乐园设计",
    ]),
  },
  {
    key: "character",
    name: "人物造型",
    description:
      "以人体为载体的造型美学。包括角色设计、服装设计、时尚摄影、数字人等。",
    icon: "User",
    color: "rose",
    criteria: JSON.stringify({
      dimensions: [
        { key: "proportion", name: "比例", desc: "人体比例的准确与风格化" },
        { key: "silhouette", name: "轮廓线", desc: "剪影的辨识度与美感" },
        {
          key: "material",
          name: "材质表现",
          desc: "面料/皮肤/金属等材质的质感",
        },
        {
          key: "styling",
          name: "风格化",
          desc: "造型风格的统一与独特性",
        },
        {
          key: "expression",
          name: "表现力",
          desc: "角色气质与情感传达",
        },
      ],
    }),
    domains: JSON.stringify([
      "角色设计",
      "服装设计",
      "时尚摄影",
      "数字人",
      "Cosplay造型",
      "特效化妆",
    ]),
  },
  {
    key: "graphic_composition",
    name: "平面构成",
    description:
      "静态画面的构成完整性。包括海报设计、品牌视觉、插画、包装等。",
    icon: "Palette",
    color: "cyan",
    criteria: JSON.stringify({
      dimensions: [
        { key: "layout", name: "排版", desc: "元素排布的秩序与张力" },
        {
          key: "negative_space",
          name: "负空间",
          desc: "留白的呼吸感与功能",
        },
        {
          key: "color_harmony",
          name: "色彩和谐",
          desc: "色彩搭配的协调与冲击力",
        },
        {
          key: "visual_weight",
          name: "视觉重心",
          desc: "画面的稳定与动感平衡",
        },
        {
          key: "completeness",
          name: "构成完整",
          desc: "整体画面的完整与自洽",
        },
      ],
    }),
    domains: JSON.stringify([
      "海报设计",
      "品牌视觉",
      "插画",
      "包装设计",
      "书籍封面",
      "Logo设计",
    ]),
  },
  {
    key: "dynamic_rhythm",
    name: "动态韵律",
    description:
      "时间维度上的韵律之美。包括动效设计、特效动画、舞蹈编排、运动图形等。",
    icon: "Zap",
    color: "amber",
    criteria: JSON.stringify({
      dimensions: [
        { key: "tempo", name: "节奏", desc: "运动速度的变化与节奏感" },
        { key: "transition", name: "过渡", desc: "帧间过渡的流畅与质感" },
        {
          key: "energy_flow",
          name: "能量流动",
          desc: "运动方向的引导与能量感",
        },
        {
          key: "musicality",
          name: "律动感",
          desc: "与音乐/节拍的呼应",
        },
        {
          key: "impact",
          name: "冲击力",
          desc: "关键时刻的视觉冲击",
        },
      ],
    }),
    domains: JSON.stringify([
      "动效设计",
      "特效动画",
      "舞蹈编排",
      "运动图形",
      "转场动画",
      "Loading动画",
    ]),
  },
];

async function seedFamilies() {
  for (const familyData of FAMILIES_DATA) {
    const existing = await db.aestheticFamily.findUnique({
      where: { key: familyData.key },
    });
    if (!existing) {
      await db.aestheticFamily.create({ data: familyData });
    } else {
      // Update if criteria or domains changed
      await db.aestheticFamily.update({
        where: { key: familyData.key },
        data: {
          name: familyData.name,
          description: familyData.description,
          icon: familyData.icon,
          color: familyData.color,
          criteria: familyData.criteria,
          domains: familyData.domains,
        },
      });
    }
  }
}

export async function GET() {
  try {
    // Ensure families exist in the database (seed if needed)
    await seedFamilies();

    const families = await db.aestheticFamily.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            evaluations: true,
            rules: true,
          },
        },
      },
    });

    // Parse JSON fields for client convenience
    const enriched = families.map((f) => ({
      ...f,
      criteria: JSON.parse(f.criteria),
      domains: JSON.parse(f.domains),
    }));

    return NextResponse.json({ families: enriched, total: enriched.length });
  } catch (error) {
    console.error("[API /families] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch aesthetic families" },
      { status: 500 }
    );
  }
}
