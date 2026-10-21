import { afterEach, beforeEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { SignJWT } from "jose";
import { signInternalToken } from "../test/authTestKeys";
import { machineTokenMock, SPORAI_SESSION_ID, sporaiMock } from "../test/authTestSetup";
import {
  allowedOrigin,
  type ChatProxyConfig,
  chatProxyRoutes,
  issueChatToken,
  loadChatProxyConfig,
  signSessionId,
} from "./chatProxy";

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

function ask(body: unknown, auth: string | null = token) {
  return app.request("/chat-proxy", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
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
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
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

test("answers 503 when one user has too many questions open, and not other users", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  sporaiMock.respond = async () => {
    await waiting;
    return new Response("svar");
  };
  const open = Array.from({ length: 2 }, async () => ask({ query: "Hei" }));
  // Wait until both calls have reached sporai.
  while (sporaiMock.calls < 2) await Bun.sleep(5);

  const busy = await ask({ query: "Hei" });
  expect(busy.status).toBe(503);
  expect(busy.headers.get("Retry-After")).toBe("5");

  // Another user can still ask.
  const other = (await issueChatToken(proxyConfig, "internal|user-2"))!.token;
  const otherOpen = ask({ query: "Hei" }, other);
  while (sporaiMock.calls < 3) await Bun.sleep(5);

  release();
  const statuses = (await Promise.all([...open, otherOpen])).map((res) => res.status);
  expect(statuses).toEqual(Array(3).fill(200));
  // The counter goes down again when the calls end.
  expect((await ask({ query: "Hei" })).status).toBe(200);
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
