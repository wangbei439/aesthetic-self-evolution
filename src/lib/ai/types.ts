// ---------------------------------------------------------------------------
// AI Provider Types — shared interface for all AI backends
// ---------------------------------------------------------------------------

/** A single chat message */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | MessageContent[];
}

/** Multi-modal message content (for vision) */
export interface MessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/** Normalized AI response */
export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** Provider health status */
export interface ProviderHealth {
  vlm: "online" | "offline" | "unknown";
  llm: "online" | "offline" | "unknown";
}

/** Provider info (exposed via /api/models) */
export interface ProviderInfo {
  provider: string;
  providerLabel: string;
  isSandbox: boolean;
  vlmModel: string;
  llmModel: string;
  baseUrl?: string;
}

/** The core AI provider interface */
export interface AIProvider {
  /** Text-only chat completion */
  chat(params: {
    model?: string;
    messages: ChatMessage[];
  }): Promise<AIResponse>;

  /** Vision + text chat completion */
  visionChat(params: {
    model?: string;
    messages: ChatMessage[];
  }): Promise<AIResponse>;

  /** Health check for VLM and LLM endpoints */
  healthCheck(): Promise<ProviderHealth>;

  /** Provider metadata */
  getInfo(): ProviderInfo;
}
