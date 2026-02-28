/**
 * Universal AI Provider Abstraction
 * Supports: Gemini, OpenAI, OpenRouter, Grok (xAI), Kimi (Moonshot), Anthropic, Custom OpenAI-compatible
 *
 * All providers are exposed through a single `generateText(prompt, options)` interface
 * so the rest of the server code never has to know which provider is active.
 */

import { GoogleGenAI } from "@google/genai";
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

// ─── Provider configs ────────────────────────────────────────────────────────

export interface ProviderConfig {
  label: string;
  description: string;
  docsUrl: string;
  defaultModel: string;
  models: { value: string; label: string }[];
  placeholder: string;     // placeholder for the API key input
  keyPrefix?: string;      // expected key prefix for validation hint
}

export const PROVIDER_CONFIGS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    label: "Google Gemini",
    description: "Google's Gemini models via AI Studio",
    docsUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.5-flash",
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
    placeholder: "AIza...",
    keyPrefix: "AIza",
  },
  openai: {
    label: "OpenAI",
    description: "GPT-4o and GPT-4 models via OpenAI API",
    docsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o Mini (Recommended)" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
    placeholder: "sk-...",
    keyPrefix: "sk-",
  },
  openrouter: {
    label: "OpenRouter",
    description: "Access 200+ models from one unified API",
    docsUrl: "https://openrouter.ai/keys",
    defaultModel: "moonshotai/kimi-k2",
    models: [
      { value: "moonshotai/kimi-k2", label: "Kimi K2 — Free (Recommended)" },
      { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5 — Free" },
      { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B — Free" },
      { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Paid)" },
      { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku (Paid)" },
      { value: "openai/gpt-4o", label: "GPT-4o (Paid)" },
      { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (Paid)" },
      { value: "mistralai/mixtral-8x7b-instruct", label: "Mixtral 8x7B — Free" },
    ],
    placeholder: "sk-or-...",
    keyPrefix: "sk-or-",
  },
  grok: {
    label: "Grok (xAI)",
    description: "Grok models by xAI (Elon Musk's AI company)",
    docsUrl: "https://console.x.ai/",
    defaultModel: "grok-3-mini",
    models: [
      { value: "grok-3-mini", label: "Grok 3 Mini (Recommended)" },
      { value: "grok-3", label: "Grok 3" },
      { value: "grok-2", label: "Grok 2" },
    ],
    placeholder: "xai-...",
    keyPrefix: "xai-",
  },
  kimi: {
    label: "Kimi K2 (Moonshot AI)",
    description: "Kimi K2 — 1T MoE model with agentic capabilities",
    docsUrl: "https://platform.moonshot.ai/",
    defaultModel: "kimi-k2",
    models: [
      { value: "kimi-k2", label: "Kimi K2 (Recommended)" },
      { value: "moonshot-v1-128k", label: "Moonshot v1 128K" },
      { value: "moonshot-v1-32k", label: "Moonshot v1 32K" },
    ],
    placeholder: "sk-...",
  },
  anthropic: {
    label: "Anthropic Claude",
    description: "Claude models via Anthropic API",
    docsUrl: "https://console.anthropic.com/keys",
    defaultModel: "claude-3-5-haiku-20241022",
    models: [
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Recommended)" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    ],
    placeholder: "sk-ant-...",
    keyPrefix: "sk-ant-",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    description: "Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.)",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    defaultModel: "gpt-3.5-turbo",
    models: [],
    placeholder: "Enter API key (or leave blank for local)",
  },
};

// ─── Platform (env-var) Gemini client used as global fallback ────────────────
const platformGemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "placeholder",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// ─── Core generate function ───────────────────────────────────────────────────

/**
 * Call the active AI provider for the given user.
 * Falls back to the platform Gemini key if the user has no key configured.
 */
export async function generateWithProvider(
  options: AiGenerateOptions,
  userRecord?: {
    activeAiProvider?: string | null;
    geminiApiKey?: string | null;
    openaiApiKey?: string | null;
    openrouterApiKey?: string | null;
    grokApiKey?: string | null;
    kimiApiKey?: string | null;
    anthropicApiKey?: string | null;
    customApiKey?: string | null;
    customApiBaseUrl?: string | null;
    customApiModel?: string | null;
  }
): Promise<AiGenerateResult> {
  const provider = (userRecord?.activeAiProvider as AiProvider) || "gemini";
  const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.gemini;

  // Build the text prompt from messages
  const systemMsg = options.messages.find(m => m.role === "system");
  const userMsgs = options.messages.filter(m => m.role !== "system");

  switch (provider) {
    case "gemini": {
      const key = userRecord?.geminiApiKey || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
      const ai = key
        ? new GoogleGenAI({ apiKey: key })
        : platformGemini;
      const model = options.model || providerConfig.defaultModel;

      // Build parts array — support image messages
      const parts: any[] = [];
      if (systemMsg) {
        parts.push({ text: typeof systemMsg.content === "string" ? systemMsg.content : "" });
      }
      for (const msg of userMsgs) {
        if (typeof msg.content === "string") {
          parts.push({ text: msg.content });
        } else {
          for (const part of msg.content) {
            if (part.type === "text") {
              parts.push({ text: part.text });
            } else if (part.type === "image_url") {
              const url = part.image_url.url;
              if (url.startsWith("data:")) {
                const [header, data] = url.split(",");
                const mimeType = header.replace("data:", "").replace(";base64", "");
                parts.push({ inlineData: { mimeType, data } });
              }
            }
          }
        }
      }

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
      });
      return { text: response.text || "", provider: "gemini", model };
    }

    case "openai":
    case "openrouter":
    case "grok":
    case "kimi":
    case "custom": {
      // All these use OpenAI-compatible REST API
      let apiKey = "";
      let baseUrl = "";
      let model = options.model || providerConfig.defaultModel;

      if (provider === "openai") {
        apiKey = userRecord?.openaiApiKey || "";
        baseUrl = "https://api.openai.com/v1";
      } else if (provider === "openrouter") {
        apiKey = userRecord?.openrouterApiKey || "";
        baseUrl = "https://openrouter.ai/api/v1";
      } else if (provider === "grok") {
        apiKey = userRecord?.grokApiKey || "";
        baseUrl = "https://api.x.ai/v1";
      } else if (provider === "kimi") {
        apiKey = userRecord?.kimiApiKey || "";
        baseUrl = "https://api.moonshot.ai/v1";
      } else {
        // custom
        apiKey = userRecord?.customApiKey || "";
        baseUrl = userRecord?.customApiBaseUrl || "http://localhost:11434/v1";
        model = options.model || userRecord?.customApiModel || providerConfig.defaultModel;
      }

      // Build messages array for OpenAI chat completions format
      const messages: any[] = [];
      for (const msg of options.messages) {
        if (typeof msg.content === "string") {
          messages.push({ role: msg.role, content: msg.content });
        } else {
          // multi-modal content
          const parts: any[] = [];
          for (const p of msg.content) {
            if (p.type === "text") parts.push({ type: "text", text: p.text });
            else if (p.type === "image_url") parts.push({ type: "image_url", image_url: p.image_url });
          }
          messages.push({ role: msg.role, content: parts });
        }
      }

      const body: any = { model, messages };
      // Always set max_tokens for OpenRouter — if caller didn't specify, use a conservative
      // 1024-token default so we stay well within free-tier credit limits.
      // For other OpenAI-compatible providers only set it when explicitly requested.
      const defaultTokenCap = provider === "openrouter" ? 1024 : undefined;
      const resolvedMaxTokens = options.maxTokens || defaultTokenCap;
      if (resolvedMaxTokens) body.max_tokens = resolvedMaxTokens;
      if (options.temperature !== undefined) body.temperature = options.temperature;
      if (options.jsonMode) body.response_format = { type: "json_object" };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      };

      // OpenRouter requires an extra header
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://eduassess.ai";
        headers["X-Title"] = "EduAssess AI";
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${provider} API error ${res.status}: ${errText.substring(0, 200)}`);
      }

      const data = await res.json() as any;
      const text = data.choices?.[0]?.message?.content || "";
      return { text, provider, model };
    }

    case "anthropic": {
      const apiKey = userRecord?.anthropicApiKey || "";
      const model = options.model || providerConfig.defaultModel;

      const messages: any[] = options.messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : m.content }));

      const body: any = {
        model,
        max_tokens: options.maxTokens || 4096,
        messages,
        ...(systemMsg && { system: typeof systemMsg.content === "string" ? systemMsg.content : "" }),
      };

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${errText.substring(0, 200)}`);
      }

      const data = await res.json() as any;
      const text = data.content?.[0]?.text || "";
      return { text, provider: "anthropic", model };
    }

    default: {
      // Fallback to platform Gemini
      const response = await platformGemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: options.messages.map(m => typeof m.content === "string" ? m.content : "").join("\n") }] }],
      });
      return { text: response.text || "", provider: "gemini", model: "gemini-2.5-flash" };
    }
  }
}

/**
 * Quick helper: test if a provider key works by sending a tiny prompt.
 * Returns { success, model, provider, error? }
 */
export async function testProviderKey(
  provider: AiProvider,
  keyFields: {
    geminiApiKey?: string;
    openaiApiKey?: string;
    openrouterApiKey?: string;
    grokApiKey?: string;
    kimiApiKey?: string;
    anthropicApiKey?: string;
    customApiKey?: string;
    customApiBaseUrl?: string;
    customApiModel?: string;
  }
): Promise<{ success: boolean; model: string; provider: AiProvider; error?: string }> {
  try {
    const result = await generateWithProvider(
      { messages: [{ role: "user", content: 'Reply with just the word "OK"' }], maxTokens: 10 },
      { activeAiProvider: provider, ...keyFields }
    );
    return { success: true, model: result.model, provider };
  } catch (err: any) {
    return { success: false, model: "", provider, error: err.message };
  }
}
