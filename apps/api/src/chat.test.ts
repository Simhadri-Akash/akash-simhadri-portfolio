import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { Express } from "express";
import type { ChatProvider } from "./services/chat-provider";
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

function provider(complete: Provider["complete"]): Provider {
  return { name: "openai", complete };
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
