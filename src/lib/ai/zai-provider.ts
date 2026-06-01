// ---------------------------------------------------------------------------
// ZAI Provider — wraps z-ai-web-dev-sdk (sandbox environment)
// ---------------------------------------------------------------------------

import ZAI from "z-ai-web-dev-sdk";
import type { AIProvider, AIResponse, ChatMessage, ProviderHealth, ProviderInfo } from "./types";

const VLM_MODEL = "glm-4.6v";
const LLM_MODEL = "glm-4-plus";

// Cache health check result for 60 seconds to avoid rate limiting
let _lastHealthCheck: { time: number; result: ProviderHealth } | null = null;
const HEALTH_CACHE_MS = 60_000;

// Retry helper with exponential backoff for 429 errors
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 5000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const is429 =
        error instanceof Error &&
        (error.message.includes('429') || error.message.includes('Too many requests'));
      if (!is429 || attempt === maxRetries) throw error;
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[ZAI] 429 rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error('Max retries exceeded');
}

export class ZAIProvider implements AIProvider {
  async chat(params: { model?: string; messages: ChatMessage[] }): Promise<AIResponse> {
    return retryWithBackoff(async () => {
      const zai = await ZAI.create();
      const response = await zai.chat.completions.create({
        model: params.model || LLM_MODEL,
        messages: params.messages as never, // SDK types are looser
      });

      return {
        content: response?.choices?.[0]?.message?.content || "",
        model: params.model || LLM_MODEL,
      };
    });
  }

  async visionChat(params: { model?: string; messages: ChatMessage[] }): Promise<AIResponse> {
    return retryWithBackoff(async () => {
      const zai = await ZAI.create();
      const response = await zai.chat.completions.createVision({
        model: params.model || VLM_MODEL,
        messages: params.messages as never,
      });

      return {
        content: response?.choices?.[0]?.message?.content || "",
        model: params.model || VLM_MODEL,
      };
    });
  }

  async healthCheck(): Promise<ProviderHealth> {
    // Return cached result if fresh
    if (_lastHealthCheck && Date.now() - _lastHealthCheck.time < HEALTH_CACHE_MS) {
      return _lastHealthCheck.result;
    }

    // Only test LLM (lighter request) — VLM uses the same gateway,
    // so if LLM is online, VLM is almost certainly online too.
    let llm: "online" | "offline" | "unknown" = "unknown";

    try {
      const zai = await ZAI.create();
      const llmTest = await Promise.race([
        zai.chat.completions.create({
          model: LLM_MODEL,
          messages: [{ role: "user", content: "Reply: OK" }],
        }).then(() => "online" as const),
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 10000)),
      ]);
      llm = llmTest === "online" ? "online" : "offline";
    } catch {
      llm = "offline";
    }

    const result: ProviderHealth = {
      vlm: llm, // Same gateway, infer VLM status from LLM
      llm,
    };

    _lastHealthCheck = { time: Date.now(), result };
    return result;
  }

  getInfo(): ProviderInfo {
    return {
      provider: "zai",
      providerLabel: "Z.ai Sandbox (z-ai-web-dev-sdk)",
      isSandbox: true,
      vlmModel: VLM_MODEL,
      llmModel: LLM_MODEL,
    };
  }
}
