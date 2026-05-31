// ---------------------------------------------------------------------------
// AI Config Store — runtime-persistent AI provider configuration
// ---------------------------------------------------------------------------
// Stores the active provider config in a JSON file so it persists across
// server restarts and can be changed at runtime via API.
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { PROVIDER_PRESETS } from "./openai-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIConfig {
  /** Which provider to use: "zai" | preset name | "custom" */
  provider: string;
  /** API key (stored locally, never sent to frontend) */
  apiKey: string;
  /** Base URL override (optional, uses preset default if not set) */
  baseUrl: string;
  /** VLM model ID */
  vlmModel: string;
  /** LLM model ID */
  llmModel: string;
  /** Display label */
  providerLabel: string;
  /** Whether this is the sandbox auto-detected config */
  isAutoDetected?: boolean;
}

/** Safe config for frontend display (API key masked) */
export interface AIConfigPublic {
  provider: string;
  apiKeySet: boolean;
  apiKeyPreview: string;
  baseUrl: string;
  vlmModel: string;
  llmModel: string;
  providerLabel: string;
  isAutoDetected?: boolean;
  availablePresets: {
    key: string;
    label: string;
    baseUrl: string;
    vlmModel: string;
    llmModel: string;
  }[];
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const CONFIG_DIR = path.join(process.cwd(), "db");
const CONFIG_FILE = path.join(CONFIG_DIR, "ai-config.json");

const DEFAULT_CONFIG: AIConfig = {
  provider: "",
  apiKey: "",
  baseUrl: "",
  vlmModel: "",
  llmModel: "",
  providerLabel: "",
  isAutoDetected: false,
};

export async function loadAIConfig(): Promise<AIConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as AIConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public config (for frontend display — masks API key)
// ---------------------------------------------------------------------------

export function toPublicConfig(config: AIConfig): AIConfigPublic {
  return {
    provider: config.provider,
    apiKeySet: !!config.apiKey,
    apiKeyPreview: config.apiKey
      ? config.apiKey.slice(0, 4) + "****" + config.apiKey.slice(-4)
      : "",
    baseUrl: config.baseUrl,
    vlmModel: config.vlmModel,
    llmModel: config.llmModel,
    providerLabel: config.providerLabel,
    isAutoDetected: config.isAutoDetected,
    availablePresets: Object.entries(PROVIDER_PRESETS).map(([key, preset]) => ({
      key,
      label: preset.providerLabel,
      baseUrl: preset.baseUrl,
      vlmModel: preset.vlmModel,
      llmModel: preset.llmModel,
    })),
  };
}

// ---------------------------------------------------------------------------
// Apply preset defaults to fill in missing fields
// ---------------------------------------------------------------------------

export function applyPresetDefaults(config: AIConfig): AIConfig {
  const preset = PROVIDER_PRESETS[config.provider];
  if (preset) {
    return {
      ...config,
      baseUrl: config.baseUrl || preset.baseUrl,
      vlmModel: config.vlmModel || preset.vlmModel,
      llmModel: config.llmModel || preset.llmModel,
      providerLabel: config.providerLabel || preset.providerLabel,
    };
  }
  return config;
}
