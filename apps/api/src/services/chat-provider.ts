import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./portfolio-chat";

export type ChatProviderName = "openai" | "gemini";

export interface ChatProvider {
  name: ChatProviderName;
  complete(message: string, signal: AbortSignal): Promise<string>;
}

interface ProviderSelection {
  provider: ChatProvider | null;
  providerName: string;
  unavailableReason?: "unconfigured" | "invalid_provider";
}

const DEFAULT_MODELS: Record<ChatProviderName, string> = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
};

export class ProviderTimeoutError extends Error {
  constructor() {
    super("Chat provider request timed out");
    this.name = "ProviderTimeoutError";
  }
}

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

// Both OpenAI and Gemini's OpenAI-compatible endpoint accept this exact
// request shape, including structured-output `response_format`, so it is
// built once and shared. Exported for direct unit testing of the request
// payload without needing a real network call.
export function buildChatCompletionRequest(
  model: string,
  message: string,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  return {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
    // `max_tokens` is deprecated by the OpenAI Chat Completions API in favor
    // of `max_completion_tokens`; Gemini's OpenAI-compatible endpoint only
    // accepts the current parameter name. Never send both.
    max_completion_tokens: 350,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "portfolio_chat_response",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["answer", "suggestions"],
          properties: {
            answer: { type: "string" },
            suggestions: {
              type: "array",
              maxItems: 4,
              items: { type: "string" },
            },
          },
        },
      },
    },
  };
}

function createOpenAICompatibleProvider(
  name: ChatProviderName,
  apiKey: string,
  model: string,
): ChatProvider {
  const client = new OpenAI({
    apiKey,
    ...(name === "gemini"
      ? {
          baseURL:
            "https://generativelanguage.googleapis.com/v1beta/openai/",
        }
      : {}),
  });

  return {
    name,
    async complete(message, signal) {
      const completion = await client.chat.completions.create(
        buildChatCompletionRequest(model, message),
        { signal },
      );

      return completion.choices[0]?.message?.content ?? "";
    },
  };
}

export function buildConfiguredChatProvider(): ProviderSelection {
  const rawProvider = configuredValue(process.env.AI_PROVIDER) ?? "openai";
  const providerName = rawProvider.toLowerCase();

  if (providerName !== "openai" && providerName !== "gemini") {
    return {
      provider: null,
      providerName,
      unavailableReason: "invalid_provider",
    };
  }

  const name: ChatProviderName = providerName;
  const apiKey = configuredValue(
    name === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GEMINI_API_KEY,
  );

  if (!apiKey) {
    return { provider: null, providerName: name, unavailableReason: "unconfigured" };
  }

  const configuredModel = configuredValue(
    name === "openai" ? process.env.OPENAI_MODEL : process.env.GEMINI_MODEL,
  );
  const model = configuredModel ?? DEFAULT_MODELS[name];

  return {
    provider: createOpenAICompatibleProvider(name, apiKey, model),
    providerName: name,
  };
}

/**
 * Safe, minimal diagnostic fields for a provider failure — HTTP status and
 * the provider's own short error code/type, nothing else. Never includes
 * the error message, request/response bodies, headers, or any credential —
 * those can carry upstream-echoed request content or provider-specific
 * detail that shouldn't reach logs.
 */
export function safeProviderErrorDetails(
  error: unknown,
): { status?: number; code?: string; type?: string } {
  if (!(error instanceof OpenAI.APIError)) return {};

  return {
    ...(typeof error.status === "number" ? { status: error.status } : {}),
    ...(typeof error.code === "string" ? { code: error.code } : {}),
    ...(typeof error.type === "string" ? { type: error.type } : {}),
  };
}

export function classifyProviderFailure(error: unknown): string {
  if (
    error instanceof ProviderTimeoutError ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return "timeout";
  }

  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "authentication";
    if (error.status === 429) return "rate_limit";
    if (typeof error.status === "number" && error.status >= 500) {
      return "provider_5xx";
    }
    return "provider_error";
  }

  return "network_or_provider_error";
}
