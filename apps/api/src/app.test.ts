import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL =
  "postgresql://portfolio:portfolio@127.0.0.1:5432/portfolio_test";
delete process.env.RESEND_API_KEY;
delete process.env.CONTACT_TO_EMAIL;
delete process.env.CONTACT_FROM_EMAIL;

const [
  { createApp, default: app },
  { closeDatabase },
  { Router },
  { createContactRouter },
  { createHealthRouter },
  { createPortfolioRouter },
  { PORTFOLIO_STATS_BASELINE, applyPortfolioStatsBaseline },
  { createShutdownHandler },
] = await Promise.all([
  import("./app"),
  import("@workspace/db"),
  import("express"),
  import("./routes/contact"),
  import("./routes/health"),
  import("./routes/portfolio"),
  import("./services/portfolio-stats"),
  import("./lib/shutdown"),
]);

let server: Server;
let baseUrl: string;

async function startServer(application = app): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const runningServer = application.listen(0, "127.0.0.1");
  await once(runningServer, "listening");

  const address = runningServer.address() as AddressInfo;
  return {
    server: runningServer,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(runningServer: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    runningServer.close((error) => (error ? reject(error) : resolve()));
  });
}

function jsonRequest(body: unknown, clientIp: string): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": clientIp,
    },
    body: JSON.stringify(body),
  };
}

before(async () => {
  ({ server, baseUrl } = await startServer());
});

after(async () => {
  await stopServer(server);
  const firstClose = closeDatabase();
  const secondClose = closeDatabase();
  assert.equal(firstClose, secondClose);
  await Promise.all([firstClose, secondClose]);
});

test("GET /api/healthz returns 200", async () => {
  const response = await fetch(`${baseUrl}/api/healthz`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("unknown API routes return a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), { error: "Not found." });
});

test("readiness returns 200 when the database dependency is healthy", async () => {
  const readinessApp = createApp(createHealthRouter(async () => {}));
  const readinessServer = await startServer(readinessApp);

  try {
    const response = await fetch(`${readinessServer.baseUrl}/api/readyz`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready" });
  } finally {
    await stopServer(readinessServer.server);
  }
});

test("readiness returns a safe 503 when the database is unavailable", async () => {
  const readinessApp = createApp(
    createHealthRouter(async () => {
      throw new Error("sensitive database connection detail");
    }),
  );
  const readinessServer = await startServer(readinessApp);

  try {
    const response = await fetch(`${readinessServer.baseUrl}/api/readyz`);
    const responseText = await response.text();

    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(responseText), { status: "not_ready" });
    assert.doesNotMatch(responseText, /sensitive database connection detail/i);
  } finally {
    await stopServer(readinessServer.server);
  }
});

test("contact rejects an invalid email", async () => {
  const response = await fetch(
    `${baseUrl}/api/contact`,
    jsonRequest(
      {
        name: "Akash",
        email: "not-an-email",
        subject: "Portfolio enquiry",
        message: "This is a sufficiently long contact message.",
      },
      "203.0.113.10",
    ),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Please check the submitted fields.",
  });
});

test("contact rejects a name that is empty after trimming", async () => {
  const response = await fetch(
    `${baseUrl}/api/contact`,
    jsonRequest(
      {
        name: "     ",
        email: "visitor@example.com",
        subject: "Portfolio enquiry",
        message: "This is a sufficiently long contact message.",
      },
      "203.0.113.11",
    ),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Please check the submitted fields.",
  });
});

test("contact rejects an oversized field", async () => {
  const response = await fetch(
    `${baseUrl}/api/contact`,
    jsonRequest(
      {
        name: "x".repeat(81),
        email: "visitor@example.com",
        subject: "Portfolio enquiry",
        message: "This is a sufficiently long contact message.",
      },
      "203.0.113.12",
    ),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Please check the submitted fields.",
  });
});

test("contact rate limiter eventually returns the documented JSON 429", async () => {
  const request = jsonRequest(
    {
      name: "Akash",
      email: "invalid",
      subject: "Portfolio enquiry",
      message: "This is a sufficiently long contact message.",
    },
    "203.0.113.50",
  );

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/contact`, request);
    assert.equal(response.status, 400);
  }

  const limitedResponse = await fetch(`${baseUrl}/api/contact`, request);
  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(await limitedResponse.json(), {
    error: "Too many requests. Please try again later.",
  });
});

test("valid contact input is normalized and persisted without email configuration", async () => {
  const savedMessages: Array<{
    name: string;
    email: string;
    subject: string;
    message: string;
    receivedAt: Date;
  }> = [];
  const contactRouter = createContactRouter({
    repository: {
      async save(message) {
        savedMessages.push(message);
      },
    },
  });
  const contactApp = createApp(contactRouter);
  const contactServer = await startServer(contactApp);

  try {
    const response = await fetch(
      `${contactServer.baseUrl}/api/contact`,
      jsonRequest(
        {
          name: "  Akash Visitor  ",
          email: "  visitor@example.com  ",
          subject: "  Portfolio enquiry  ",
          message: "  This is a sufficiently long contact message.  ",
        },
        "203.0.113.60",
      ),
    );

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(savedMessages.length, 1);
    assert.deepEqual(
      {
        name: savedMessages[0]?.name,
        email: savedMessages[0]?.email,
        subject: savedMessages[0]?.subject,
        message: savedMessages[0]?.message,
      },
      {
        name: "Akash Visitor",
        email: "visitor@example.com",
        subject: "Portfolio enquiry",
        message: "This is a sufficiently long contact message.",
      },
    );
    assert.ok(savedMessages[0]?.receivedAt instanceof Date);
  } finally {
    await stopServer(contactServer.server);
  }
});

test("notification failure after persistence still returns success", async () => {
  const savedMessages: unknown[] = [];
  let notificationAttempts = 0;
  const contactRouter = createContactRouter({
    repository: {
      async save(message) {
        savedMessages.push(message);
      },
    },
    async notify() {
      notificationAttempts += 1;
      throw new Error("provider unavailable");
    },
  });
  const contactApp = createApp(contactRouter);
  const contactServer = await startServer(contactApp);

  try {
    const response = await fetch(
      `${contactServer.baseUrl}/api/contact`,
      jsonRequest(
        {
          name: "Akash Visitor",
          email: "visitor@example.com",
          subject: "Portfolio enquiry",
          message: "This is a sufficiently long contact message.",
        },
        "203.0.113.61",
      ),
    );

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(savedMessages.length, 1);
    assert.equal(notificationAttempts, 1);
  } finally {
    await stopServer(contactServer.server);
  }
});

function createMemoryPortfolioRepository(inquiries = 0) {
  const visits = new Map<string, { count: number; lastSeenAt: Date }>();

  return {
    visits,
    repository: {
      async recordVisit(visitorId: string, seenAt: Date) {
        const current = visits.get(visitorId);
        visits.set(visitorId, {
          count: (current?.count ?? 0) + 1,
          lastSeenAt: seenAt,
        });
      },
      async getStats() {
        return applyPortfolioStatsBaseline({ visitors: visits.size, inquiries });
      },
    },
  };
}

test("portfolio visit records a new anonymous UUID", async () => {
  const memory = createMemoryPortfolioRepository();
  const seenAt = new Date("2026-08-09T12:00:00.000Z");
  const portfolioApp = createApp(
    createPortfolioRouter({ repository: memory.repository, now: () => seenAt }),
  );
  const portfolioServer = await startServer(portfolioApp);

  try {
    const response = await fetch(
      `${portfolioServer.baseUrl}/api/portfolio/visit`,
      jsonRequest({ visitorId: "662ef82a-4f43-4c3c-98ef-5c761f749106" }, "203.0.113.70"),
    );

    assert.equal(response.status, 204);
    assert.equal(memory.visits.size, 1);
    assert.deepEqual(memory.visits.get("662ef82a-4f43-4c3c-98ef-5c761f749106"), {
      count: 1,
      lastSeenAt: seenAt,
    });
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("repeat portfolio visits upsert one unique visitor and increment its count", async () => {
  const memory = createMemoryPortfolioRepository();
  const visitorId = "61e7d009-ad59-41a6-a656-83a5e7e9cdf4";
  const portfolioApp = createApp(createPortfolioRouter({ repository: memory.repository }));
  const portfolioServer = await startServer(portfolioApp);

  try {
    for (const clientIp of ["203.0.113.71", "203.0.113.72"]) {
      const response = await fetch(
        `${portfolioServer.baseUrl}/api/portfolio/visit`,
        jsonRequest({ visitorId }, clientIp),
      );
      assert.equal(response.status, 204);
    }

    assert.equal(memory.visits.size, 1);
    assert.equal(memory.visits.get(visitorId)?.count, 2);
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("same visitor refreshing does not increase the displayed unique visitor count", async () => {
  const memory = createMemoryPortfolioRepository();
  const visitorId = "9d3a3e1a-9f5a-4f4a-8b3a-6f6b8b9b6a1a";
  const portfolioApp = createApp(createPortfolioRouter({ repository: memory.repository }));
  const portfolioServer = await startServer(portfolioApp);

  try {
    const readDisplayedVisitors = async () => {
      const response = await fetch(`${portfolioServer.baseUrl}/api/portfolio/stats`);
      const body = (await response.json()) as { visitors: number };
      return body.visitors;
    };

    await fetch(
      `${portfolioServer.baseUrl}/api/portfolio/visit`,
      jsonRequest({ visitorId }, "203.0.113.80"),
    );
    const afterFirstVisit = await readDisplayedVisitors();

    // Simulates the same browser refreshing the page and re-sending its
    // stored anonymous visitor id.
    await fetch(
      `${portfolioServer.baseUrl}/api/portfolio/visit`,
      jsonRequest({ visitorId }, "203.0.113.81"),
    );
    const afterRefresh = await readDisplayedVisitors();

    assert.equal(afterFirstVisit, PORTFOLIO_STATS_BASELINE.visitors + 1);
    assert.equal(afterRefresh, afterFirstVisit);
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("portfolio visit rejects malformed identifiers without persistence", async () => {
  const memory = createMemoryPortfolioRepository();
  const portfolioApp = createApp(createPortfolioRouter({ repository: memory.repository }));
  const portfolioServer = await startServer(portfolioApp);

  try {
    const response = await fetch(
      `${portfolioServer.baseUrl}/api/portfolio/visit`,
      jsonRequest({ visitorId: "not-a-uuid", fingerprint: "must-not-be-stored" }, "203.0.113.73"),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Please check the submitted fields." });
    assert.equal(memory.visits.size, 0);
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("portfolio stats API returns baseline-inclusive final values", async () => {
  const memory = createMemoryPortfolioRepository(7);
  await memory.repository.recordVisit("d9dbafdf-c593-4070-bfe6-d23ee50bbc78", new Date());
  await memory.repository.recordVisit("bf76d745-fe81-44cc-99c5-ccfd7fdcf955", new Date());
  const portfolioApp = createApp(createPortfolioRouter({ repository: memory.repository }));
  const portfolioServer = await startServer(portfolioApp);

  try {
    const response = await fetch(`${portfolioServer.baseUrl}/api/portfolio/stats`);

    assert.equal(response.status, 200);
    // 35 baseline + 2 raw visitors, 8 baseline + 7 raw inquiries, fixed 9 active builds.
    assert.deepEqual(await response.json(), {
      visitors: 37,
      inquiries: 15,
      activeBuilds: 9,
    });
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("the route returns the repository's stats unchanged, so the baseline is never applied twice", async () => {
  // The repository here already returns final, baseline-inclusive numbers —
  // exactly as the production repository does. If the route (or anything
  // downstream) re-applied the baseline, these arbitrary sentinel values
  // would not round-trip unchanged.
  const sentinelStats = { visitors: 111, inquiries: 222, activeBuilds: 9 };
  const portfolioApp = createApp(
    createPortfolioRouter({
      repository: {
        async recordVisit() {},
        async getStats() {
          return sentinelStats;
        },
      },
    }),
  );
  const portfolioServer = await startServer(portfolioApp);

  try {
    const response = await fetch(`${portfolioServer.baseUrl}/api/portfolio/stats`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), sentinelStats);
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("stats baseline: zero recorded visitors displays the 35-visitor baseline", () => {
  assert.equal(applyPortfolioStatsBaseline({ visitors: 0, inquiries: 0 }).visitors, 35);
});

test("stats baseline: five recorded visitors displays 40", () => {
  assert.equal(applyPortfolioStatsBaseline({ visitors: 5, inquiries: 0 }).visitors, 40);
});

test("stats baseline: no new inquiries displays the 8-inquiry baseline", () => {
  assert.equal(applyPortfolioStatsBaseline({ visitors: 0, inquiries: 0 }).inquiries, 8);
});

test("stats baseline: one new valid inquiry displays 9", () => {
  assert.equal(applyPortfolioStatsBaseline({ visitors: 0, inquiries: 1 }).inquiries, 9);
});

test("stats baseline: active builds is a fixed 9, independent of visitor or inquiry activity", () => {
  assert.equal(applyPortfolioStatsBaseline({ visitors: 0, inquiries: 0 }).activeBuilds, 9);
  assert.equal(applyPortfolioStatsBaseline({ visitors: 500, inquiries: 500 }).activeBuilds, 9);
  assert.equal(PORTFOLIO_STATS_BASELINE.activeBuilds, 9);
});

test("portfolio storage failures return safe 503 responses", async () => {
  const portfolioApp = createApp(
    createPortfolioRouter({
      repository: {
        async recordVisit() {
          throw new Error("postgresql://secret-host/private-database");
        },
        async getStats() {
          throw new Error("postgresql://secret-host/private-database");
        },
      },
    }),
  );
  const portfolioServer = await startServer(portfolioApp);

  try {
    const statsResponse = await fetch(`${portfolioServer.baseUrl}/api/portfolio/stats`);
    const visitResponse = await fetch(
      `${portfolioServer.baseUrl}/api/portfolio/visit`,
      jsonRequest({ visitorId: "5c3bce81-e078-4cdf-8f43-c9c336b9b4bc" }, "203.0.113.74"),
    );
    const statsText = await statsResponse.text();
    const visitText = await visitResponse.text();

    assert.equal(statsResponse.status, 503);
    assert.equal(visitResponse.status, 503);
    assert.doesNotMatch(`${statsText}${visitText}`, /secret-host|private-database|stack/i);
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("portfolio visit persistence receives only the anonymous UUID and timestamp", async () => {
  const receivedArguments: unknown[][] = [];
  const portfolioApp = createApp(
    createPortfolioRouter({
      repository: {
        async recordVisit(...args: [string, Date]) {
          receivedArguments.push(args);
        },
        async getStats() {
          return applyPortfolioStatsBaseline({ visitors: 0, inquiries: 0 });
        },
      },
    }),
  );
  const portfolioServer = await startServer(portfolioApp);

  try {
    const visitorId = "4c35f9d7-f79b-45db-ae11-c988b95ff517";
    const response = await fetch(`${portfolioServer.baseUrl}/api/portfolio/visit`, {
      ...jsonRequest({ visitorId }, "198.51.100.24"),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.24",
        "user-agent": "Sensitive Browser Signature",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(receivedArguments.length, 1);
    assert.equal(receivedArguments[0]?.length, 2);
    assert.equal(receivedArguments[0]?.[0], visitorId);
    assert.ok(receivedArguments[0]?.[1] instanceof Date);
    assert.doesNotMatch(JSON.stringify(receivedArguments), /198\.51\.100\.24|Sensitive Browser/i);
  } finally {
    await stopServer(portfolioServer.server);
  }
});

test("central error handler returns a safe JSON 500", async () => {
  const failingRouter = Router();
  failingRouter.get("/explode", () => {
    throw new Error("sensitive provider detail");
  });

  const failingApp = createApp(failingRouter);
  const failingServer = await startServer(failingApp);

  try {
    const response = await fetch(`${failingServer.baseUrl}/api/explode`);
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(JSON.parse(responseText), {
      error: "Internal server error.",
    });
    assert.doesNotMatch(responseText, /sensitive provider detail|stack/i);
  } finally {
    await stopServer(failingServer.server);
  }
});

test("graceful shutdown closes HTTP and database resources only once", async () => {
  const shutdownApp = createApp(Router());
  const shutdownServer = await startServer(shutdownApp);
  let databaseCloseCount = 0;
  const exitCodes: number[] = [];
  const shutdown = createShutdownHandler({
    server: shutdownServer.server,
    async closeDatabase() {
      databaseCloseCount += 1;
    },
    timeoutMs: 1_000,
    exit(code) {
      exitCodes.push(code);
    },
  });

  const firstShutdown = shutdown("SIGTERM");
  const secondShutdown = shutdown("SIGINT");
  await Promise.all([firstShutdown, secondShutdown]);

  assert.equal(firstShutdown, secondShutdown);
  assert.equal(databaseCloseCount, 1);
  assert.deepEqual(exitCodes, [0]);
  assert.equal(shutdownServer.server.listening, false);
});
