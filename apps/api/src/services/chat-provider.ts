import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { logger } from "../lib/logger";
import { ProviderOutputSchema, SYSTEM_PROMPT } from "./portfolio-chat";

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

// Exported so the source default can be asserted directly in tests, keeping
// it honest against whatever production is actually configured to run.
export const DEFAULT_MODELS: Record<ChatProviderName, string> = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-3.6-flash",
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

// Both OpenAI and Gemini's OpenAI-compatible endpoint accept this request
// shape. `response_format` is derived once from the single authoritative
// `ProviderOutputSchema` (see portfolio-chat.ts) via the SDK's own
// `zodResponseFormat` helper, so the request-time schema hint sent to the
// provider and the response-time validator can never drift apart.
// Exported for direct unit testing of the request payload without needing a
// real network call.
export function buildChatCompletionRequest(
  name: ChatProviderName,
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
    // accepts the current parameter name. Never send both. Gemini 3.6 Flash
    // is a thinking model — its reasoning tokens draw from the same
    // completion budget as the final answer, so it gets more headroom than
    // a non-reasoning model like OpenAI's gpt-4.1-mini, which is left as-is.
    max_completion_tokens: name === "gemini" ? 700 : 350,
    temperature: 0.2,
    // This portfolio FAQ doesn't need extensive reasoning; keep Gemini 3.6
    // Flash's thinking budget minimal. Not a supported/needed param for the
    // OpenAI model in use, so it's only sent for Gemini.
    ...(name === "gemini" ? { reasoning_effort: "low" as const } : {}),
    response_format: zodResponseFormat(
      ProviderOutputSchema,
      "portfolio_chat_response",
    ),
  };
}

/**
 * Safe, content-free diagnostics for when a provider's structured output
 * comes back missing or unparseable — enough to diagnose the failure mode
 * (e.g. truncated by the token budget vs. a genuine schema mismatch)
 * without ever logging the model's actual answer, the user's message, or
 * the system prompt.
 */
export function describeInvalidStructuredOutput(choice: {
  finish_reason?: string | null;
  message?: { parsed?: unknown; content?: string | null };
} | undefined): { finishReason?: string; hasParsedOutput: boolean; contentLength: number } {
  const content = choice?.message?.content ?? "";
  return {
    ...(choice?.finish_reason ? { finishReason: choice.finish_reason } : {}),
    hasParsedOutput: choice?.message?.parsed != null,
    contentLength: content.length,
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
      const completion = await client.chat.completions.parse(
        buildChatCompletionRequest(name, model, message),
        { signal },
      );

      const choice = completion.choices[0];
      const parsed = choice?.message?.parsed;

      if (!parsed) {
        logger.warn(
          { provider: name, ...describeInvalidStructuredOutput(choice) },
          "Chat provider structured output missing or unparseable",
        );
      }

      // `parsed` is the SDK-verified structured result; re-serializing it
      // keeps parseProviderOutput() as the one final defense-in-depth
      // validator downstream. If parsing failed, the raw content (if any)
      // is passed through unchanged for that same validator to reject.
      return parsed ? JSON.stringify(parsed) : (choice?.message?.content ?? "");
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
