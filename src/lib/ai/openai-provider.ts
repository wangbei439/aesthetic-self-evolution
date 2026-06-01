// ---------------------------------------------------------------------------
// OpenAI-Compatible Provider — works with Zhipu, OpenAI, DeepSeek, etc.
// ---------------------------------------------------------------------------

import type { AIProvider, AIResponse, ChatMessage, ProviderHealth, ProviderInfo } from "./types";

interface OpenAIProviderConfig {
  /** API key (required) */
  apiKey: string;
  /** Base URL (default: https://api.openai.com/v1) */
  baseUrl: string;
  /** VLM model ID (e.g. "glm-4v-plus" for Zhipu) */
  vlmModel: string;
  /** LLM model ID (e.g. "glm-4-plus" for Zhipu) */
  llmModel: string;
  /** Provider label for display */
  providerLabel: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  private config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""), // remove trailing slash
      apiKey: config.apiKey,
      vlmModel: config.vlmModel,
      llmModel: config.llmModel,
      providerLabel: config.providerLabel,
    };
  }

  async chat(params: { model?: string; messages: ChatMessage[] }): Promise<AIResponse> {
    const model = params.model || this.config.llmModel;

    // Convert messages: string content is fine, array content needs format check
    const messages = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(120000), // 2 min timeout for chat
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `OpenAI-compatible API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    return {
      content: data?.choices?.[0]?.message?.content || "",
      model: data?.model || model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async visionChat(params: { model?: string; messages: ChatMessage[] }): Promise<AIResponse> {
    const model = params.model || this.config.vlmModel;

    // For vision, we need the full message format with content arrays
    const messages = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(120000), // 2 min timeout for vision
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `OpenAI-compatible Vision API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    return {
      content: data?.choices?.[0]?.message?.content || "",
      model: data?.model || model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    let vlm: "online" | "offline" | "unknown" = "unknown";
    let llm: "online" | "offline" | "unknown" = "unknown";

    try {
      const llmResult = await Promise.race([
        this.chat({
          model: this.config.llmModel,
          messages: [{ role: "user", content: "Reply: OK" }],
        }).then(() => "online" as const),
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 10000)),
      ]);
      llm = llmResult === "online" ? "online" : "offline";
    } catch {
      llm = "offline";
    }

    try {
      const vlmResult = await Promise.race([
        this.visionChat({
          model: this.config.vlmModel,
          messages: [{ role: "user", content: [{ type: "text", text: "Reply: OK" }] }],
        }).then(() => "online" as const),
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 10000)),
      ]);
      vlm = vlmResult === "online" ? "online" : "offline";
    } catch {
      vlm = "offline";
    }

    return { vlm, llm };
  }

  getInfo(): ProviderInfo {
    return {
      provider: "openai-compatible",
      providerLabel: this.config.providerLabel,
      isSandbox: false,
      vlmModel: this.config.vlmModel,
      llmModel: this.config.llmModel,
      baseUrl: this.config.baseUrl,
    };
  }
}

// ---------------------------------------------------------------------------
// Preset configurations for popular providers
// ---------------------------------------------------------------------------

export const PROVIDER_PRESETS: Record<string, Omit<OpenAIProviderConfig, "apiKey">> = {
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vlmModel: "glm-4v-plus",
    llmModel: "glm-4-plus",
    providerLabel: "智谱 GLM (ZhipuAI)",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    vlmModel: "gpt-4o",
    llmModel: "gpt-4o",
    providerLabel: "OpenAI",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    vlmModel: "deepseek-chat", // DeepSeek doesn't have a dedicated VLM
    llmModel: "deepseek-chat",
    providerLabel: "DeepSeek",
  },
  moonshot: {
    baseUrl: "https://api.moonshot.cn/v1",
    vlmModel: "moonshot-v1-8k",
    llmModel: "moonshot-v1-8k",
    providerLabel: "Moonshot (月之暗面)",
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1",
    vlmModel: "Pro/Qwen/Qwen2.5-VL-7B-Instruct",
    llmModel: "Qwen/Qwen2.5-7B-Instruct",
    providerLabel: "SiliconFlow (硅基流动)",
  },
};
