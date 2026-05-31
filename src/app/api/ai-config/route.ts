import { NextResponse } from "next/server";
import {
  loadAIConfig,
  saveAIConfig,
  toPublicConfig,
  applyPresetDefaults,
  type AIConfig,
} from "@/lib/ai/config-store";
import { resetAIProvider } from "@/lib/ai";

// ---------------------------------------------------------------------------
// GET /api/ai-config — Return current AI provider config (API key masked)
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const config = await loadAIConfig();

    // If no runtime config is set, check if ZAI is auto-detected
    if (!config.provider) {
      try {
        const mod = await import("z-ai-web-dev-sdk");
        if (mod?.default) {
          config.provider = "zai";
          config.isAutoDetected = true;
          config.providerLabel = "Z.ai Sandbox (自动检测)";
        }
      } catch {
        // SDK not available
      }
    }

    return NextResponse.json(toPublicConfig(config));
  } catch (error) {
    console.error("[API /ai-config GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load AI config" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/ai-config — Update AI provider config (triggers provider reset)
// ---------------------------------------------------------------------------
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const {
      provider,
      apiKey,
      baseUrl,
      vlmModel,
      llmModel,
      providerLabel,
    } = body as Partial<AIConfig>;

    // Validate provider
    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    // For "zai" provider, no API key needed
    if (provider === "zai") {
      const newConfig: AIConfig = {
        provider: "zai",
        apiKey: "",
        baseUrl: "",
        vlmModel: "",
        llmModel: "",
        providerLabel: "Z.ai Sandbox",
        isAutoDetected: false,
      };
      await saveAIConfig(newConfig);
      resetAIProvider();
      return NextResponse.json({
        success: true,
        message: "Switched to Z.ai Sandbox provider",
        config: toPublicConfig(newConfig),
      });
    }

    // For other providers, API key is required
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required for this provider" },
        { status: 400 }
      );
    }

    // Load existing config to preserve API key if user didn't send a new one
    const existingConfig = await loadAIConfig();
    const effectiveApiKey = apiKey === "****keep****" ? existingConfig.apiKey : apiKey;

    const newConfig: AIConfig = applyPresetDefaults({
      provider,
      apiKey: effectiveApiKey,
      baseUrl: baseUrl || "",
      vlmModel: vlmModel || "",
      llmModel: llmModel || "",
      providerLabel: providerLabel || "",
      isAutoDetected: false,
    });

    // Validate required fields
    if (!newConfig.baseUrl) {
      return NextResponse.json(
        { error: "Base URL is required. Select a preset provider or enter a custom URL." },
        { status: 400 }
      );
    }

    if (!newConfig.vlmModel || !newConfig.llmModel) {
      return NextResponse.json(
        { error: "Both VLM and LLM model IDs are required." },
        { status: 400 }
      );
    }

    await saveAIConfig(newConfig);

    // Reset the provider singleton so next API call uses the new config
    resetAIProvider();

    console.log(`[AI Config] Provider switched to: ${newConfig.providerLabel || newConfig.provider}`);

    return NextResponse.json({
      success: true,
      message: `Provider switched to ${newConfig.providerLabel || newConfig.provider}`,
      config: toPublicConfig(newConfig),
    });
  } catch (error) {
    console.error("[API /ai-config PUT] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update AI config", details: message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/ai-config — Reset to default (clear runtime config)
// ---------------------------------------------------------------------------
export async function DELETE() {
  try {
    const defaultConfig: AIConfig = {
      provider: "",
      apiKey: "",
      baseUrl: "",
      vlmModel: "",
      llmModel: "",
      providerLabel: "",
      isAutoDetected: false,
    };

    await saveAIConfig(defaultConfig);
    resetAIProvider();

    return NextResponse.json({
      success: true,
      message: "AI config reset to default. Will auto-detect on next request.",
    });
  } catch (error) {
    console.error("[API /ai-config DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset AI config" },
      { status: 500 }
    );
  }
}
