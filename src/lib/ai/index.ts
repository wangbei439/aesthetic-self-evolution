// ---------------------------------------------------------------------------
// AI Provider Factory — supports runtime provider switching
// ---------------------------------------------------------------------------
//
// Config priority:
//   1. Runtime config (stored in db/ai-config.json, set via /api/ai-config)
//   2. Environment variables (fallback for initial setup)
//   3. Auto-detect Z.ai Sandbox SDK
//
// When user changes provider via the UI, the runtime config is saved and
// the provider singleton is reset — next API call uses the new provider.
// ---------------------------------------------------------------------------

import type { AIProvider } from "./types";
import { ZAIProvider } from "./zai-provider";
import { OpenAICompatibleProvider, PROVIDER_PRESETS } from "./openai-provider";
import { loadAIConfig, applyPresetDefaults } from "./config-store";

let _provider: AIProvider | null = null;

/**
 * Check if z-ai-web-dev-sdk is importable.
 */
async function isZAIAvailable(): Promise<boolean> {
  try {
    const mod = await import("z-ai-web-dev-sdk");
    return !!mod?.default;
  } catch {
    return false;
  }
}

/**
 * Get or create the AI provider.
 * Checks runtime config first, then env vars, then auto-detects sandbox.
 */
export async function getAIProvider(): Promise<AIProvider> {
  if (_provider) return _provider;

  // ---- Step 1: Check runtime config file ----
  const runtimeConfig = await loadAIConfig();

  if (runtimeConfig.provider === "zai" || (!runtimeConfig.provider && !process.env.AI_PROVIDER)) {
    // Auto-detect sandbox
    const available = await isZAIAvailable();
    if (available) {
      console.log("[AI Provider] Using Z.ai Sandbox provider (auto-detected)");
      _provider = new ZAIProvider();
      return _provider;
    }
  }

  // ---- Step 2: Use runtime config if provider is set ----
  if (runtimeConfig.provider && runtimeConfig.apiKey) {
    const filledConfig = applyPresetDefaults(runtimeConfig);
    const preset = PROVIDER_PRESETS[runtimeConfig.provider];

    if (preset || runtimeConfig.provider === "custom") {
      console.log(`[AI Provider] Using runtime config: ${filledConfig.providerLabel || filledConfig.provider}`);

      if (runtimeConfig.provider === "zai") {
        // ZAI was explicitly chosen but SDK not available
        throw new Error(
          "AI_PROVIDER is set to 'zai' but z-ai-web-dev-sdk is not available. " +
          "This provider only works in the Z.ai sandbox environment."
        );
      }

      const baseUrl = filledConfig.baseUrl;
      const vlmModel = filledConfig.vlmModel;
      const llmModel = filledConfig.llmModel;

      if (!baseUrl) {
        throw new Error(
          `Provider "${runtimeConfig.provider}" requires a base URL. ` +
          "Please configure it in the AI settings."
        );
      }

      if (!vlmModel || !llmModel) {
        throw new Error(
          "Both VLM and LLM model IDs are required. Please configure them in AI settings."
        );
      }

      _provider = new OpenAICompatibleProvider({
        apiKey: runtimeConfig.apiKey,
        baseUrl,
        vlmModel,
        llmModel,
        providerLabel: filledConfig.providerLabel || runtimeConfig.provider,
      });
      return _provider;
    }
  }

  // ---- Step 3: Fallback to environment variables ----
  const providerName = process.env.AI_PROVIDER?.toLowerCase()?.trim() || "";

  if (providerName === "zai" || providerName === "") {
    const available = await isZAIAvailable();
    if (available) {
      console.log("[AI Provider] Using Z.ai Sandbox provider (from env)");
      _provider = new ZAIProvider();
      return _provider;
    }

    if (providerName === "") {
      throw new Error(
        "No AI provider configured. Use the AI Settings panel or set AI_PROVIDER and AI_API_KEY in .env."
      );
    }
  }

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      `AI_PROVIDER is set to "${providerName}" but AI_API_KEY is missing.`
    );
  }

  const preset = PROVIDER_PRESETS[providerName];
  if (preset) {
    console.log(`[AI Provider] Using env preset: ${preset.providerLabel}`);
    _provider = new OpenAICompatibleProvider({
      apiKey,
      baseUrl: process.env.AI_BASE_URL?.trim() || preset.baseUrl,
      vlmModel: process.env.AI_VLM_MODEL?.trim() || preset.vlmModel,
      llmModel: process.env.AI_LLM_MODEL?.trim() || preset.llmModel,
      providerLabel: process.env.AI_PROVIDER_LABEL?.trim() || preset.providerLabel,
    });
    return _provider;
  }

  // Custom provider from env
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const vlmModel = process.env.AI_VLM_MODEL?.trim();
  const llmModel = process.env.AI_LLM_MODEL?.trim();

  if (!baseUrl || !vlmModel || !llmModel) {
    throw new Error(
      "Custom AI provider requires AI_BASE_URL, AI_VLM_MODEL, and AI_LLM_MODEL in .env."
    );
  }

  console.log(`[AI Provider] Using custom env provider: ${baseUrl}`);
  _provider = new OpenAICompatibleProvider({
    apiKey,
    baseUrl,
    vlmModel,
    llmModel,
    providerLabel: process.env.AI_PROVIDER_LABEL?.trim() || `Custom (${baseUrl})`,
  });

  return _provider;
}

/**
 * Reset the singleton — next getAIProvider() call will re-read config.
 * Called when user changes provider via the UI.
 */
export function resetAIProvider(): void {
  _provider = null;
}

/**
 * Get provider info without creating a full instance.
 */
export function getCurrentProviderInfo() {
  return _provider?.getInfo() || null;
}
