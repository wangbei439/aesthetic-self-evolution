import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";

// ---------------------------------------------------------------------------
// GET /api/models — Return available models, their status, and current config
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    let providerInfo;
    let health;

    try {
      const ai = await getAIProvider();
      providerInfo = ai.getInfo();
      health = await ai.healthCheck();
    } catch (err) {
      // Provider not configured — return config guide
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({
        configured: false,
        error: message,
        setupGuide: {
          description: "Set AI_PROVIDER and AI_API_KEY in .env to enable AI features",
          availableProviders: ["zhipu", "openai", "deepseek", "moonshot", "siliconflow", "custom"],
          example: {
            zhipu: "AI_PROVIDER=zhipu\nAI_API_KEY=your_zhipu_api_key",
            openai: "AI_PROVIDER=openai\nAI_API_KEY=your_openai_api_key",
            custom: "AI_PROVIDER=custom\nAI_API_KEY=your_key\nAI_BASE_URL=https://your-api.com/v1\nAI_VLM_MODEL=gpt-4o\nAI_LLM_MODEL=gpt-4o",
          },
        },
      }, { status: 200 });
    }

    // Build model list from provider info
    const models = [
      {
        id: providerInfo.vlmModel,
        name: providerInfo.vlmModel,
        type: "vlm" as const,
        status: health.vlm,
        usageContext: "图片审美评估、域分类、视觉特征分析",
      },
      {
        id: providerInfo.llmModel,
        name: providerInfo.llmModel,
        type: "llm" as const,
        status: health.llm,
        usageContext: "进化反思分析、跨家族规则迁移、规则生成",
      },
    ];

    // Task → model mapping
    const defaultModels: Record<string, string> = {
      classification: providerInfo.vlmModel,
      evaluation: providerInfo.vlmModel,
      reflection: providerInfo.llmModel,
      transfer: providerInfo.llmModel,
    };

    return NextResponse.json({
      configured: true,
      models,
      defaultModels,
      provider: {
        name: providerInfo.providerLabel,
        provider: providerInfo.provider,
        isSandbox: providerInfo.isSandbox,
        baseUrl: providerInfo.baseUrl || undefined,
      },
      systemCapabilities: {
        imageEvaluation: health.vlm === "online",
        textReasoning: health.llm === "online",
        evolutionCycle: health.vlm === "online" && health.llm === "online",
        crossFamilyTransfer: health.llm === "online",
      },
    });
  } catch (error) {
    console.error("[API /models] Error:", error);
    return NextResponse.json(
      { error: "Failed to check model status" },
      { status: 500 }
    );
  }
}
