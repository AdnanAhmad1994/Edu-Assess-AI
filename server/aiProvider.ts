/**
 * Groq Exclusive AI Provider Abstraction
 * Optimized for ultra-fast Llama 3 and Mixtral inference.
 */

import type { AiProvider } from "@shared/schema";

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export interface AiGenerateOptions {
  messages: AiMessage[];
  model?: string;          // override the default model for a provider
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;      // hint that the response should be JSON
}

export interface AiGenerateResult {
  text: string;
  provider: AiProvider;
  model: string;
}

// ─── Groq Provider config ───────────────────────────────────────────────────

export interface ProviderConfig {
  label: string;
  description: string;
  docsUrl: string;
  defaultModel: string;
  models: { value: string; label: string }[];
  placeholder: string;
  keyPrefix?: string;
}

export const PROVIDER_CONFIGS: Record<AiProvider, ProviderConfig> = {
  groq: {
    label: "Groq Cloud",
    description: "Ultra-fast Llama 3 & Mixtral inference",
    docsUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Recommended)" },
      { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
      { value: "gemma2-9b-it", label: "Gemma 2 9B" },
    ],
    placeholder: "gsk_...",
    keyPrefix: "gsk_",
  },
};

// ─── Core generate function ───────────────────────────────────────────────────

/**
 * Call the exclusive Groq AI provider.
 */
export async function generateWithProvider(
  options: AiGenerateOptions,
  userRecord?: {
    activeAiProvider?: string | null;
    groqApiKey?: string | null;
    groqApiModel?: string | null;
  }
): Promise<AiGenerateResult> {
  const provider: AiProvider = "groq";
  const providerConfig = PROVIDER_CONFIGS.groq;

  // Use the user's key if provided, otherwise fallback to env
  const apiKey = userRecord?.groqApiKey || process.env.GROQ_API_KEY || "";
  const baseUrl = "https://api.groq.com/openai/v1";
  const model = options.model || userRecord?.groqApiModel || providerConfig.defaultModel;

  // Build messages array for OpenAI chat completions format
  const messages: any[] = [];
  for (const msg of options.messages) {
    if (typeof msg.content === "string") {
      messages.push({ role: msg.role, content: msg.content });
    } else {
      // multi-modal content (Groq supports text and some vision models)
      const parts: any[] = [];
      for (const p of msg.content) {
        if (p.type === "text") parts.push({ type: "text", text: p.text });
        else if (p.type === "image_url") parts.push({ type: "image_url", image_url: p.image_url });
      }
      messages.push({ role: msg.role, content: parts });
    }
  }

  const body: any = { model, messages };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content || "";
  return { text, provider, model };
}

/**
 * Quick helper: test if Groq key works by sending a tiny prompt.
 */
export async function testProviderKey(
  provider: AiProvider,
  keyFields: {
    groqApiKey?: string;
    groqApiModel?: string;
  }
): Promise<{ success: boolean; model: string; provider: AiProvider; error?: string }> {
  try {
    const result = await generateWithProvider(
      { messages: [{ role: "user", content: 'Reply with just the word "OK"' }], maxTokens: 10 },
      { activeAiProvider: "groq", ...keyFields }
    );
    return { success: true, model: result.model, provider: "groq" };
  } catch (err: any) {
    return { success: false, model: "", provider: "groq", error: err.message };
  }
}
