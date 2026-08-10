import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { Express } from "express";
import OpenAI from "openai";
import {
  buildChatCompletionRequest,
  buildConfiguredChatProvider,
  classifyProviderFailure,
  safeProviderErrorDetails,
  type ChatProvider,
} from "./services/chat-provider";
import { localAnswer, SYSTEM_PROMPT } from "./services/portfolio-chat";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL =
  "postgresql://portfolio:portfolio@127.0.0.1:5432/portfolio_test";

const [{ createApp }, { createChatRouter }] = await Promise.all([
  import("./app"),
  import("./routes/chat"),
]);

type Provider = ChatProvider;
type ChatBody = { answer: string; suggestedQuestions: string[] };

async function jsonBody<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function startServer(application: Express): Promise<{ server: Server; baseUrl: string }> {
  const server = application.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function provider(
  complete: Provider["complete"],
  name: Provider["name"] = "openai",
): Provider {
  return { name, complete };
}

function chatRequest(message: unknown, clientIp: string): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": clientIp },
    body: JSON.stringify({ message }),
  };
}

async function withChatServer(
  configuredProvider: Provider | null,
  run: (baseUrl: string) => Promise<void>,
  timeoutMs = 20_000,
): Promise<void> {
  const running = await startServer(
    createApp(createChatRouter({ provider: configuredProvider, timeoutMs })),
  );
  try {
    await run(running.baseUrl);
  } finally {
    await stopServer(running.server);
  }
}

test("no configured provider returns a deterministic local fallback", async () => {
  await withChatServer(null, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Who is Akash?", "203.0.113.101"));
    const body = await jsonBody<ChatBody>(response);
    assert.equal(response.status, 200);
    assert.match(body.answer, /software engineer/i);
    assert.ok(Array.isArray(body.suggestedQuestions));
  });
});

test("portfolio grounding keeps factual project and capability boundaries", () => {
  assert.match(SYSTEM_PROMPT, /Emergency Response AI \(In Development\)/);
  assert.match(SYSTEM_PROMPT, /CampusConnect \(Core Completed · Improvements Ongoing\)/);
  assert.match(SYSTEM_PROMPT, /Core Platform Completed; UI\/UX Modernization in Progress/);
  assert.match(SYSTEM_PROMPT, /real AI provider calls, production backend APIs, live tracking, RAG pipeline/);
  assert.doesNotMatch(SYSTEM_PROMPT, /Anthropic|Integrate Any LLM Provider|RAG concepts/);

  assert.match(localAnswer("Tell me about Emergency Response AI").answer, /in development/i);
  assert.match(localAnswer("Tell me about DonorHub").answer, /UI\/UX modernization in progress/i);
  assert.match(localAnswer("Tell me about CampusConnect").answer, /core campus platform is completed/i);
  assert.match(localAnswer("What is his education?").answer, /2022 to 2026/);
  assert.match(localAnswer("Is Akash available for work?").answer, /remote and on-site/i);
});

test("valid structured provider output is validated and normalized", async () => {
  let receivedMessage = "";
  await withChatServer(
    provider(async (message) => {
      receivedMessage = message;
      return JSON.stringify({
        answer: "  A concise verified answer.  ",
        suggestions: ["  First question?  ", "", "Second question?"],
      });
    }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("  Tell me about Akash  ", "203.0.113.102"));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        answer: "A concise verified answer.",
        suggestedQuestions: ["First question?", "Second question?"],
      });
      assert.equal(receivedMessage, "Tell me about Akash");
    },
  );
});

test("a fenced JSON object is parsed but never returned without validation", async () => {
  await withChatServer(
    provider(async () =>
      '```json\n{"answer":"Verified answer","suggestions":["Next?"]}\n```'),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Tell me about Akash", "203.0.113.109"));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        answer: "Verified answer",
        suggestedQuestions: ["Next?"],
      });
    },
  );
});

test("invalid provider JSON activates safe local fallback", async () => {
  await withChatServer(provider(async () => "ANSWER: malformed provider output"), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, chatRequest("What are his skills?", "203.0.113.103"));
    const body = await jsonBody<ChatBody>(response);
    assert.equal(response.status, 200);
    assert.match(body.answer, /TypeScript/);
    assert.doesNotMatch(body.answer, /malformed provider output/);
  });
});

test("provider output with the wrong schema activates fallback", async () => {
  await withChatServer(
    provider(async () => JSON.stringify({ answer: "Untrusted", suggestions: "not-an-array" })),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Tell me about DonorHub", "203.0.113.104"));
      const body = await jsonBody<ChatBody>(response);
      assert.equal(response.status, 200);
      assert.match(body.answer, /DonorHub/);
      assert.notEqual(body.answer, "Untrusted");
    },
  );
});

test("provider timeout aborts the request and activates fallback", async () => {
  let observedAbort = false;
  await withChatServer(
    provider((_message, signal) => new Promise<string>(() => {
      signal.addEventListener("abort", () => { observedAbort = true; });
    })),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("What is his education?", "203.0.113.105"));
      assert.equal(response.status, 200);
      assert.match((await jsonBody<ChatBody>(response)).answer, /B\.Tech/);
      assert.equal(observedAbort, true);
    },
    10,
  );
});

test("provider network or 5xx failure activates fallback", async () => {
  await withChatServer(
    provider(async () => { throw new Error("sensitive upstream response body"); }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Is Akash available for work?", "203.0.113.106"));
      const responseText = await response.text();
      assert.equal(response.status, 200);
      assert.match(responseText, /open to/i);
      assert.doesNotMatch(responseText, /sensitive upstream response body/i);
    },
  );
});

test("excessive provider suggestions and lengths are bounded", async () => {
  await withChatServer(
    provider(async () => JSON.stringify({
      answer: "a".repeat(2_000),
      suggestions: ["1".repeat(200), "two", "three", "four", "five"],
    })),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("What projects has he built?", "203.0.113.107"));
      const body = await jsonBody<ChatBody>(response);
      assert.equal(response.status, 200);
      assert.equal(body.answer.length, 1_600);
      assert.equal(body.suggestedQuestions.length, 4);
      assert.equal(body.suggestedQuestions[0].length, 120);
    },
  );
});

test("an empty provider answer is rejected and falls back", async () => {
  await withChatServer(
    provider(async () => JSON.stringify({ answer: "   ", suggestions: [] })),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Tell me about Akash", "203.0.113.108"));
      const body = await jsonBody<ChatBody>(response);
      assert.equal(response.status, 200);
      assert.match(body.answer, /Andhra Pradesh/);
    },
  );
});

test("invalid and unsafe chat requests retain safe validation behavior", async () => {
  await withChatServer(null, async (baseUrl) => {
    for (const [index, message] of ["   ", "valid\u0000hidden", "x"].entries()) {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest(message, `203.0.113.${120 + index}`));
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "Please check the submitted fields." });
    }
  });
});

test("chat rate limiting remains operational", async () => {
  await withChatServer(null, async (baseUrl) => {
    const request = chatRequest("x", "203.0.113.150");
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/chat`, request);
      assert.equal(response.status, 400);
    }
    const limited = await fetch(`${baseUrl}/api/chat`, request);
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { error: "Too many requests. Please try again later." });
  });
});

// ─── Gemini provider fix regression coverage ────────────────────────────────

function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) previous[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("AI_PROVIDER=gemini with a configured key selects the Gemini provider", () => {
  withEnv(
    {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: undefined,
      OPENAI_API_KEY: undefined,
    },
    () => {
      const selection = buildConfiguredChatProvider();
      assert.equal(selection.providerName, "gemini");
      assert.equal(selection.provider?.name, "gemini");
      assert.equal(selection.unavailableReason, undefined);
    },
  );
});

test("no AI_PROVIDER configured defaults to openai, and with no key falls back to null (local answer path)", () => {
  withEnv(
    { AI_PROVIDER: undefined, OPENAI_API_KEY: undefined, GEMINI_API_KEY: undefined },
    () => {
      const selection = buildConfiguredChatProvider();
      assert.equal(selection.providerName, "openai");
      assert.equal(selection.provider, null);
      assert.equal(selection.unavailableReason, "unconfigured");
    },
  );
});

test("the shared chat-completion request uses max_completion_tokens, never max_tokens", () => {
  const request = buildChatCompletionRequest("gemini-2.5-flash", "What is DonorHub?");
  assert.equal(request.max_completion_tokens, 350);
  assert.equal("max_tokens" in request, false);
});

test("the shared chat-completion request includes strict structured-output json_schema (used for both providers, including Gemini)", () => {
  const request = buildChatCompletionRequest("gemini-2.5-flash", "What is DonorHub?");
  assert.equal(request.response_format?.type, "json_schema");
  const jsonSchema = (request.response_format as unknown as {
    json_schema: { strict: boolean; schema: unknown };
  }).json_schema;
  assert.equal(jsonSchema.strict, true);
  assert.deepEqual(jsonSchema.schema, {
    type: "object",
    additionalProperties: false,
    required: ["answer", "suggestions"],
    properties: {
      answer: { type: "string" },
      suggestions: { type: "array", maxItems: 4, items: { type: "string" } },
    },
  });
});

test("malformed Gemini provider output activates the safe local fallback", async () => {
  await withChatServer(
    provider(async () => "not valid json at all", "gemini"),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("What are his skills?", "203.0.113.160"));
      const body = await jsonBody<ChatBody>(response);
      assert.equal(response.status, 200);
      assert.match(body.answer, /TypeScript/);
    },
  );
});

test("a Gemini 400 API error activates the safe local fallback", async () => {
  const geminiBadRequest = new OpenAI.APIError(
    400,
    { message: "Unsupported parameter", type: "invalid_request_error", code: "invalid_value" },
    "400 Unsupported parameter",
    undefined,
  );
  await withChatServer(
    provider(async () => { throw geminiBadRequest; }, "gemini"),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Tell me about Akash", "203.0.113.161"));
      const body = await jsonBody<ChatBody>(response);
      assert.equal(response.status, 200);
      assert.match(body.answer, /Andhra Pradesh/);
    },
  );
});

test("safe error categorization: a 400 APIError classifies as provider_error and exposes only status/code/type", () => {
  const error = new OpenAI.APIError(
    400,
    { message: "sensitive upstream detail that must never be logged", type: "invalid_request_error", code: "invalid_value" },
    "400 sensitive upstream detail that must never be logged",
    undefined,
  );

  assert.equal(classifyProviderFailure(error), "provider_error");

  const details = safeProviderErrorDetails(error);
  assert.deepEqual(details, { status: 400, code: "invalid_value", type: "invalid_request_error" });
  assert.deepEqual(Object.keys(details).sort(), ["code", "status", "type"]);
  assert.doesNotMatch(JSON.stringify(details), /sensitive upstream detail/);
});

test("safe error categorization: 401/403 -> authentication, 429 -> rate_limit, 5xx -> provider_5xx", () => {
  const unauthorized = new OpenAI.APIError(401, { message: "no" }, "401", undefined);
  const rateLimited = new OpenAI.APIError(429, { message: "no" }, "429", undefined);
  const serverError = new OpenAI.APIError(503, { message: "no" }, "503", undefined);

  assert.equal(classifyProviderFailure(unauthorized), "authentication");
  assert.equal(classifyProviderFailure(rateLimited), "rate_limit");
  assert.equal(classifyProviderFailure(serverError), "provider_5xx");
});

test("safeProviderErrorDetails returns nothing for non-APIError failures (no secrets, no bodies)", () => {
  assert.deepEqual(safeProviderErrorDetails(new Error("network reset, contained a fake api key sk-secret")), {});
  assert.deepEqual(safeProviderErrorDetails("a plain string failure"), {});
  assert.deepEqual(safeProviderErrorDetails(undefined), {});
});

test("OpenAI provider still completes successfully end to end (unaffected by the Gemini fix)", async () => {
  await withChatServer(
    provider(async () => JSON.stringify({ answer: "OpenAI still works.", suggestions: ["Next?"] }), "openai"),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, chatRequest("Tell me about Akash", "203.0.113.162"));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        answer: "OpenAI still works.",
        suggestedQuestions: ["Next?"],
      });
    },
  );
});
