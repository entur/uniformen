import { afterEach, beforeEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { SignJWT } from "jose";
import { INTERNAL_AUDIENCE, signInternalToken } from "../test/authTestKeys";
import { machineTokenMock, SPORAI_SESSION_ID, sporaiMock } from "../test/authTestSetup";
import {
  allowedOrigin,
  type ChatProxyConfig,
  chatProxyRoutes,
  issueChatToken,
  loadChatProxyConfig,
  signSessionId,
} from "./chatProxy";
import { SporaiClient } from "./sporaiClient";

const ORIGIN = "https://partner.dev.entur.org";

let proxyConfig: ChatProxyConfig;
let app: OpenAPIHono;
let token: string;

beforeEach(async () => {
  machineTokenMock.reset();
  sporaiMock.reset();
  // A new app for every test, so the counter of active sporai calls and the machine token
  // cache do not carry over.
  proxyConfig = loadChatProxyConfig()!;
  app = new OpenAPIHono();
  chatProxyRoutes(app, proxyConfig, "dev");
  token = (await issueChatToken(proxyConfig, "internal|user-1"))!.token;
});

afterEach(() => setSystemTime());

function ask(body: unknown, auth: string | null = token, signal?: AbortSignal) {
  return app.request("/chat-proxy", {
    method: "POST",
    signal,
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Waits until `condition` is true. Fails after one second, so a broken limiter does not hang the test. */
async function waitFor(condition: () => boolean) {
  const deadline = Date.now() + 1000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await Bun.sleep(5);
  }
}

describe("POST /chat-proxy", () => {
  test("creates a session for the first question and returns the reply", async () => {
    let sent: unknown;
    sporaiMock.respond = async (req) => {
      sent = await req.json();
      return new Response("svar");
    };
    const res = await ask({ query: " Hva er en rolle? ", location: "/price-and-product" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.reply).toBe("svar");
    expect(body.sessionId).toBe(
      signSessionId(proxyConfig.sessionKey, "internal|user-1", SPORAI_SESSION_ID),
    );
    expect(sent).toEqual({
      sessionId: SPORAI_SESSION_ID,
      query: "Hva er en rolle?",
      location: "/price-and-product",
    });
  });

  test("uses the session from the request", async () => {
    let sent: unknown;
    sporaiMock.respond = async (req) => {
      sent = await req.json();
      return new Response("svar");
    };
    const sessionId = crypto.randomUUID();
    const signed = signSessionId(proxyConfig.sessionKey, "internal|user-1", sessionId);
    const res = await ask({ query: "Og så?", sessionId: signed });
    expect(await res.json()).toEqual({ reply: "svar", sessionId: signed });
    expect(sent).toEqual({ sessionId, query: "Og så?" });
  });

  test("leaves out a location that sporai would reject", async () => {
    let sent: unknown;
    sporaiMock.respond = async (req) => {
      sent = await req.json();
      return new Response("svar");
    };
    const res = await ask({ query: "Hei", location: "price-and-product, fare-structures" });
    expect(res.status).toBe(200);
    expect(sent).toEqual({ sessionId: SPORAI_SESSION_ID, query: "Hei" });
  });

  test("returns 404 when sporai does not know the session", async () => {
    sporaiMock.respond = () => new Response(null, { status: 404 });
    const sessionId = signSessionId(proxyConfig.sessionKey, "internal|user-1", crypto.randomUUID());
    const res = await ask({ query: "Hei", sessionId });
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({ title: "Not Found", status: 404 });
    expect(sporaiMock.calls).toBe(1);
  });

  test("returns 404 for another user's session and does not call sporai", async () => {
    const sessionOfA = signSessionId(proxyConfig.sessionKey, "internal|user-a", SPORAI_SESSION_ID);
    const res = await ask({ query: "Hva spurte A om?", sessionId: sessionOfA });
    expect(res.status).toBe(404);
    expect(sporaiMock.calls).toBe(0);
  });

  test.each([
    ["a bare sporai session id", SPORAI_SESSION_ID],
    ["a changed signature", `${SPORAI_SESSION_ID}.AAAA`],
    [
      "a session id from another key",
      signSessionId(new Uint8Array(32), "internal|user-1", SPORAI_SESSION_ID),
    ],
    [
      "a changed session id with the old signature",
      `${crypto.randomUUID()}.${signSessionId(loadChatProxyConfig()!.sessionKey, "internal|user-1", SPORAI_SESSION_ID).split(".")[1]}`,
    ],
  ])("returns 404 for %s and does not call sporai", async (_name, sessionId) => {
    const res = await ask({ query: "Hei", sessionId });
    expect(res.status).toBe(404);
    expect(sporaiMock.calls).toBe(0);
  });

  test("returns 503 when sporai fails", async () => {
    sporaiMock.respond = () => new Response("boom", { status: 500 });
    const res = await ask({ query: "Hei" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ title: "Service Unavailable", status: 503 });
  });

  test("returns 500 with CORS headers and no error details for an unexpected error", async () => {
    const chat = spyOn(SporaiClient.prototype, "chat").mockRejectedValue(
      new Error("secret detail"),
    );
    // Hono logs the error. Keep the test output clean.
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await ask({ query: "Hei" });
      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toBe("application/problem+json");
      expect(await res.text()).toBe(
        JSON.stringify({ title: "Internal Server Error", status: 500 }),
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    } finally {
      chat.mockRestore();
      log.mockRestore();
    }
    // The user's open call was released, so the next question works.
    expect((await ask({ query: "Hei igjen" })).status).toBe(200);
  });

  test.each([
    ["an empty query", { query: "   " }],
    ["a query that is too long", { query: "a".repeat(1001) }],
    ["a session id that is too long", { query: "Hei", sessionId: "a".repeat(201) }],
    ["the old field name text", { text: "Hei" }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await ask(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ title: "Bad Request", status: 400 });
    expect(sporaiMock.calls).toBe(0);
  });

  test("returns 400 with CORS headers for a body that is not JSON", async () => {
    const res = await ask("{not json");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({ title: "Bad Request", status: 400 });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  test.each([
    ["text/plain", { "Content-Type": "text/plain" }],
    ["no Content-Type", {}],
  ])("returns 415 with CORS headers for %s", async (_name, contentType) => {
    const res = await app.request("/chat-proxy", {
      method: "POST",
      headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, ...contentType },
      body: JSON.stringify({ query: "Hei" }),
    });
    expect(res.status).toBe(415);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({ title: "Unsupported Media Type", status: 415 });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(sporaiMock.calls).toBe(0);
  });

  test("returns 413 for a body over 8 KiB", async () => {
    const res = await ask({ query: "a".repeat(9000) });
    expect(res.status).toBe(413);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });
});

describe("chat token", () => {
  test("is required", async () => {
    const res = await ask({ query: "Hei" }, null);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe('Bearer error="invalid_token"');
    // The browser can only read the status when the CORS headers are there.
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(sporaiMock.calls).toBe(0);
  });

  test("is not an Auth0 token", async () => {
    const res = await ask({ query: "Hei" }, await signInternalToken({ sub: "chat-auth0" }));
    expect(res.status).toBe(401);
  });

  test("without a user is rejected", async () => {
    const anonymous = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("uniformen-chat")
      .setExpirationTime("60m")
      .sign(proxyConfig.key);
    const res = await ask({ query: "Hei" }, anonymous);
    expect(res.status).toBe(401);
    expect(sporaiMock.calls).toBe(0);
  });

  test("expires after 8 hours", async () => {
    setSystemTime(new Date(Date.now() + 8 * 60 * 60 * 1000 + 60 * 1000));
    const res = await ask({ query: "Hei" });
    expect(res.status).toBe(401);
  });

  test("from another key is rejected", async () => {
    const other = { ...proxyConfig, key: new Uint8Array(32) };
    const res = await ask(
      { query: "Hei" },
      (await issueChatToken(other, "internal|user-1"))!.token,
    );
    expect(res.status).toBe(401);
  });

  test("comes with the URL for the environment", async () => {
    expect((await issueChatToken(proxyConfig, "internal|user-1"))?.url).toMatch(/\/chat-proxy$/);
    expect(await issueChatToken(undefined, "internal|user-1")).toBeUndefined();
  });
});

test("answers 429 when one user has too many questions open, and not other users", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  sporaiMock.respond = async () => {
    await waiting;
    return new Response("svar");
  };
  const open = Array.from({ length: 2 }, async () => ask({ query: "Hei" }));
  // Wait until both calls have reached sporai.
  await waitFor(() => sporaiMock.calls >= 2);

  const busy = await ask({ query: "Hei" });
  expect(busy.status).toBe(429);
  expect(busy.headers.get("Retry-After")).toBe("5");
  expect(await busy.json()).toEqual({ title: "Too Many Open Chats", status: 429 });

  // Another user can still ask.
  const other = (await issueChatToken(proxyConfig, "internal|user-2"))!.token;
  const otherOpen = ask({ query: "Hei" }, other);
  await waitFor(() => sporaiMock.calls >= 3);

  release();
  const statuses = (await Promise.all([...open, otherOpen])).map((res) => res.status);
  expect(statuses).toEqual(Array(3).fill(200));
  // The counter goes down again when the calls end.
  expect((await ask({ query: "Hei" })).status).toBe(200);
});

describe("a failed call gives the open call back", () => {
  // The limit is 2 open calls, so 3 failures in a row only pass if each one gives its place back.
  async function expectPlaceIsGivenBack(
    call: (i: number) => Response | Promise<Response>,
    status: number,
  ) {
    for (let i = 0; i < 3; i++) expect((await call(i)).status).toBe(status);
    sporaiMock.reset();
    expect((await ask({ query: "Hei" })).status).toBe(200);
  }

  test("when sporai answers with an error", async () => {
    sporaiMock.respond = () => new Response("boom", { status: 500 });
    await expectPlaceIsGivenBack(() => ask({ query: "Hei" }), 503);
  });

  test("when sporai takes too long", async () => {
    const slow = new SporaiClient(
      {
        baseUrl: process.env["SPORAI_URL"]!,
        tokenUri: process.env["AUTH0_INTERNAL_TOKEN_URI"]!,
        clientId: process.env["MNG_AUTH0_INT_CLIENT_ID"]!,
        clientSecret: process.env["MNG_AUTH0_INT_CLIENT_SECRET"]!,
        audience: INTERNAL_AUDIENCE,
      },
      { timeoutMs: 50 },
    );
    app = new OpenAPIHono();
    chatProxyRoutes(app, { ...proxyConfig, client: slow }, "dev");
    sporaiMock.respond = async () => {
      await Bun.sleep(300);
      return new Response("svar");
    };
    await expectPlaceIsGivenBack(() => ask({ query: "Hei" }), 503);
  });

  test("when the user cancels the request", async () => {
    sporaiMock.respond = async () => {
      await Bun.sleep(300);
      return new Response("svar");
    };
    await expectPlaceIsGivenBack(async (i) => {
      const controller = new AbortController();
      const response = ask({ query: "Hei" }, token, controller.signal);
      await waitFor(() => sporaiMock.calls > i);
      controller.abort();
      return response;
    }, 503);
  });
});

test("returns 503 when sporai cannot create a session, and does not ask the question", async () => {
  const create = spyOn(SporaiClient.prototype, "createSession").mockResolvedValue({
    kind: "error",
  });
  try {
    const res = await ask({ query: "Hei" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ title: "Service Unavailable", status: 503 });
    expect(sporaiMock.calls).toBe(0);
  } finally {
    create.mockRestore();
  }
  // The open call was given back.
  expect((await ask({ query: "Hei" })).status).toBe(200);
});

describe("rate limit", () => {
  test("answers 429 after 10 calls to sporai in a minute, and allows calls again later", async () => {
    setSystemTime(new Date("2026-01-01T12:00:00Z"));
    for (let i = 0; i < 10; i++) expect((await ask({ query: "Hei" })).status).toBe(200);

    setSystemTime(new Date("2026-01-01T12:00:20Z"));
    const calls = sporaiMock.calls;
    const limited = await ask({ query: "Hei" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("40");
    expect(await limited.json()).toEqual({ title: "Too Many Requests", status: 429 });
    expect(sporaiMock.calls).toBe(calls);

    // Another user is not affected.
    const other = (await issueChatToken(proxyConfig, "internal|user-2"))!.token;
    expect((await ask({ query: "Hei" }, other)).status).toBe(200);

    setSystemTime(new Date("2026-01-01T12:01:01Z"));
    expect((await ask({ query: "Hei" })).status).toBe(200);
  });

  test.each([
    [
      "another user's session",
      () =>
        ask({
          query: "Hei",
          sessionId: signSessionId(proxyConfig.sessionKey, "internal|user-2", "s-1"),
        }),
      404,
    ],
    [
      "a changed session id",
      () => ask({ query: "Hei", sessionId: `${SPORAI_SESSION_ID}.AAAA` }),
      404,
    ],
    ["an invalid body", () => ask({ query: "   " }), 400],
    ["a body that is not JSON", () => ask("{not json"), 400],
    ["a missing chat token", () => ask({ query: "Hei" }, null), 401],
  ])("does not count %s, because it never reaches sporai", async (_name, failing, status) => {
    for (let i = 0; i < 10; i++) expect((await failing()).status).toBe(status);
    expect(sporaiMock.calls).toBe(0);
    // All 10 calls are still free.
    for (let i = 0; i < 10; i++) expect((await ask({ query: "Hei" })).status).toBe(200);
    expect((await ask({ query: "Hei" })).status).toBe(429);
  });

  test("counts a question when sporai fails", async () => {
    sporaiMock.respond = () => new Response("boom", { status: 500 });
    for (let i = 0; i < 10; i++) expect((await ask({ query: "Hei" })).status).toBe(503);
    expect((await ask({ query: "Hei" })).status).toBe(429);
  });

  test("allows a call again exactly 60 seconds after the call that used the last slot", async () => {
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    setSystemTime(start);
    for (let i = 0; i < 10; i++) expect((await ask({ query: "Hei" })).status).toBe(200);

    setSystemTime(start + 59_999);
    const limited = await ask({ query: "Hei" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");

    setSystemTime(start + 60_000);
    expect((await ask({ query: "Hei" })).status).toBe(200);
  });

  test("rounds Retry-After up to whole seconds", async () => {
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    setSystemTime(start);
    for (let i = 0; i < 10; i++) await ask({ query: "Hei" });

    // 59.5 seconds are left.
    setSystemTime(start + 500);
    expect((await ask({ query: "Hei" })).headers.get("Retry-After")).toBe("60");
  });

  test("uses a sliding window, and Retry-After counts from the oldest call", async () => {
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    setSystemTime(start);
    for (let i = 0; i < 5; i++) expect((await ask({ query: "Hei" })).status).toBe(200);
    setSystemTime(start + 30_000);
    for (let i = 0; i < 5; i++) expect((await ask({ query: "Hei" })).status).toBe(200);

    // The 5 calls from the start are now out of the window. The 5 later calls are not.
    setSystemTime(start + 60_000);
    for (let i = 0; i < 5; i++) expect((await ask({ query: "Hei" })).status).toBe(200);
    const limited = await ask({ query: "Hei" });
    expect(limited.status).toBe(429);
    // The oldest call left is from 30 seconds ago.
    expect(limited.headers.get("Retry-After")).toBe("30");
  });
});

describe("CORS", () => {
  test("allows a preflight from an Entur origin", async () => {
    const res = await app.request("/chat-proxy", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Authorization,Content-Type");
  });

  test("rejects a preflight from localhost in staging", async () => {
    const staging = new OpenAPIHono();
    chatProxyRoutes(staging, proxyConfig, "staging");
    const res = await staging.request("/chat-proxy", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test.each([
    ["https://partner.entur.org", "dev", true],
    ["https://uniformen.dev.entur.no", "dev", true],
    ["https://evilentur.org", "dev", false],
    ["https://entur.org.evil.com", "dev", false],
    ["https://entur.no.evil.com", "dev", false],
    ["null", "dev", false],
    ["null", "production", false],
    ["http://partner.entur.org", "dev", false],
    ["http://localhost:3000", "dev", true],
    ["http://localhost:5173", "dev", true],
    ["https://localhost:5173", "dev", true],
    ["http://127.0.0.1:3000", "dev", true],
    ["http://localhost:3000", "staging", false],
    ["http://localhost:3000", "production", false],
    ["http://127.0.0.1:3000", "staging", false],
    ["http://localhost.evil.com", "dev", false],
    ["http://localhost.:3000", "dev", false],
    ["http://[::1]:3000", "dev", false],
    ["ws://localhost:3000", "dev", false],
    ["http://evillocalhost", "dev", false],
    ["http://localhost:3000@evil.com", "dev", false],
    ["https://127.0.0.1:3000", "local", true],
    ["http://localhost:3000", "local", true],
    ["not a url", "dev", false],
  ] as const)("%s in %s is allowed: %p", (origin, env, allowed) => {
    expect(allowedOrigin(origin, env)).toBe(allowed ? origin : undefined);
  });
});

describe("loadChatProxyConfig", () => {
  test("turns chat off and names the missing variable", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const env = { ...process.env, SPORAI_URL: "" };
    expect(loadChatProxyConfig(env)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith("Chat is off. Missing env vars: SPORAI_URL");
    warn.mockRestore();
  });

  test("adds no route when chat is off", async () => {
    const off = new OpenAPIHono();
    chatProxyRoutes(off, undefined, "dev");
    expect((await off.request("/chat-proxy", { method: "POST" })).status).toBe(404);
  });
});

describe("rate limit cleanup", () => {
  let runCleanup: () => void;
  let cleanupPeriodMs: number | undefined;

  beforeEach(() => {
    // Catch the timer instead of waiting 60 seconds. The timer must be created while the
    // spy is on, so these tests build their own app.
    const intervalSpy = spyOn(globalThis, "setInterval").mockImplementation(((
      callback: () => void,
      ms: number,
    ) => {
      runCleanup = callback;
      cleanupPeriodMs = ms;
      return { unref() {} };
    }) as never);
    try {
      app = new OpenAPIHono();
      chatProxyRoutes(app, proxyConfig, "dev");
    } finally {
      intervalSpy.mockRestore();
    }
  });

  /** Runs the cleanup once and returns the users that it removed from the map. */
  function removedUsers() {
    const deleteSpy = spyOn(Map.prototype, "delete");
    try {
      runCleanup();
      return deleteSpy.mock.calls
        .map(([key]) => String(key))
        .filter((key) => key.startsWith("internal|"));
    } finally {
      deleteSpy.mockRestore();
    }
  }

  test("runs every 60 seconds", () => {
    expect(cleanupPeriodMs).toBe(60_000);
  });

  test("removes a user 60 seconds after the last call, and not before", async () => {
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    setSystemTime(start);
    await ask({ query: "Hei" });

    setSystemTime(start + 59_999);
    expect(removedUsers()).toEqual([]);

    setSystemTime(start + 60_000);
    expect(removedUsers()).toEqual(["internal|user-1"]);
  });

  test("keeps a user whose newest call is less than 60 seconds old", async () => {
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    setSystemTime(start);
    await ask({ query: "Hei" });
    setSystemTime(start + 50_000);
    await ask({ query: "Hei" });

    // The first call is 60 seconds old, but the second is only 10 seconds old.
    setSystemTime(start + 60_000);
    expect(removedUsers()).toEqual([]);

    setSystemTime(start + 110_000);
    expect(removedUsers()).toEqual(["internal|user-1"]);
  });

  test("removes only the users who have been quiet", async () => {
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    const other = (await issueChatToken(proxyConfig, "internal|user-2"))!.token;
    setSystemTime(start);
    await ask({ query: "Hei" });
    setSystemTime(start + 30_000);
    await ask({ query: "Hei" }, other);

    setSystemTime(start + 60_000);
    expect(removedUsers()).toEqual(["internal|user-1"]);
  });
});
