import { afterEach, beforeEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { SignJWT } from "jose";
import { signInternalToken } from "../test/authTestKeys";
import { machineTokenMock, SPORAI_SESSION_ID, sporaiMock } from "../test/authTestSetup";
import { allowedOrigin, type Chat, chatRoutes, issueChatToken, loadChat } from "./chat";

const ORIGIN = "https://partner.dev.entur.org";

let chat: Chat;
let app: OpenAPIHono;
let token: string;

beforeEach(async () => {
  machineTokenMock.reset();
  sporaiMock.reset();
  // A new app for every test, so the in-flight counter and the machine token
  // cache do not carry over.
  chat = loadChat()!;
  app = new OpenAPIHono();
  chatRoutes(app, chat, "dev");
  token = (await issueChatToken(chat, "internal|user-1"))!.token;
});

afterEach(() => setSystemTime());

function ask(body: unknown, auth: string | null = token) {
  return app.request("/chat", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /chat", () => {
  test("creates a session for the first question and returns the answer", async () => {
    let sent: unknown;
    sporaiMock.respond = async (req) => {
      sent = await req.json();
      return new Response("svar");
    };
    const res = await ask({ text: " Hva er en rolle? ", page: "/price-and-product" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ reply: "svar", session: SPORAI_SESSION_ID });
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
    const session = crypto.randomUUID();
    const res = await ask({ text: "Og så?", session });
    expect(await res.json()).toEqual({ reply: "svar", session });
    expect(sent).toEqual({ sessionId: session, query: "Og så?" });
  });

  test("leaves out a page that sporai would reject", async () => {
    let sent: unknown;
    sporaiMock.respond = async (req) => {
      sent = await req.json();
      return new Response("svar");
    };
    const res = await ask({ text: "Hei", page: "price-and-product, fare-structures" });
    expect(res.status).toBe(200);
    expect(sent).toEqual({ sessionId: SPORAI_SESSION_ID, query: "Hei" });
  });

  test("returns 410 when sporai does not know the session", async () => {
    sporaiMock.respond = () => new Response(null, { status: 404 });
    const res = await ask({ text: "Hei", session: crypto.randomUUID() });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "SessionExpired" });
  });

  test("returns 502 when sporai fails", async () => {
    sporaiMock.respond = () => new Response("boom", { status: 500 });
    const res = await ask({ text: "Hei" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Unavailable" });
  });

  test.each([
    ["empty text", { text: "   " }],
    ["too long text", { text: "a".repeat(1001) }],
    ["a session that is not a UUID", { text: "Hei", session: "abc" }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await ask(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid" });
    expect(sporaiMock.calls).toBe(0);
  });

  test("returns 400 with CORS headers for a body that is not JSON", async () => {
    const res = await ask("{not json");
    expect(res.status).toBe(400);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  test("returns 413 for a body over 8 KiB", async () => {
    const res = await ask({ text: "a".repeat(9000) });
    expect(res.status).toBe(413);
  });
});

describe("chat token", () => {
  test("is required", async () => {
    const res = await ask({ text: "Hei" }, null);
    expect(res.status).toBe(401);
    // The browser can only read the status when the CORS headers are there.
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(sporaiMock.calls).toBe(0);
  });

  test("is not an Auth0 token", async () => {
    const res = await ask({ text: "Hei" }, await signInternalToken({ sub: "chat-auth0" }));
    expect(res.status).toBe(401);
  });

  test("without a user is rejected", async () => {
    const anonymous = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("uniformen-chat")
      .setExpirationTime("60m")
      .sign(chat.key);
    const res = await ask({ text: "Hei" }, anonymous);
    expect(res.status).toBe(401);
    expect(sporaiMock.calls).toBe(0);
  });

  test("expires after 60 minutes", async () => {
    setSystemTime(new Date(Date.now() + 61 * 60 * 1000));
    const res = await ask({ text: "Hei" });
    expect(res.status).toBe(401);
  });

  test("from another key is rejected", async () => {
    const other = { ...chat, key: new Uint8Array(32) };
    const res = await ask({ text: "Hei" }, (await issueChatToken(other, "internal|user-1"))!.token);
    expect(res.status).toBe(401);
  });

  test("comes with the URL for the environment", async () => {
    expect((await issueChatToken(chat, "internal|user-1"))?.url).toMatch(/\/chat$/);
    expect(await issueChatToken(undefined, "internal|user-1")).toBeUndefined();
  });
});

test("answers 503 when too many questions are open in the pod", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  sporaiMock.respond = async () => {
    await waiting;
    return new Response("svar");
  };
  const open = Array.from({ length: 10 }, async () => ask({ text: "Hei" }));
  // Wait until all ten calls have reached sporai.
  while (sporaiMock.calls < 10) await Bun.sleep(5);

  const busy = await ask({ text: "Hei" });
  expect(busy.status).toBe(503);
  expect(busy.headers.get("Retry-After")).toBe("5");

  release();
  expect((await Promise.all(open)).map((res) => res.status)).toEqual(Array(10).fill(200));
  // The counter goes down again when the calls end.
  expect((await ask({ text: "Hei" })).status).toBe(200);
});

describe("CORS", () => {
  test("allows a preflight from an Entur origin", async () => {
    const res = await app.request("/chat", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Authorization,Content-Type");
  });

  test.each([
    ["https://partner.entur.org", "dev", true],
    ["https://uniformen.dev.entur.no", "dev", true],
    ["https://evilentur.org", "dev", false],
    ["https://entur.org.evil.com", "dev", false],
    ["http://partner.entur.org", "dev", false],
    ["http://localhost:3000", "dev", false],
    ["http://localhost:3000", "local", true],
    ["not a url", "dev", false],
  ] as const)("%s in %s is allowed: %p", (origin, env, allowed) => {
    expect(allowedOrigin(origin, env)).toBe(allowed ? origin : undefined);
  });
});

describe("loadChat", () => {
  test("turns chat off and names the missing variable", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const env = { ...process.env, SPORAI_URL: "" };
    expect(loadChat(env)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith("Chat is off. Missing env vars: SPORAI_URL");
    warn.mockRestore();
  });

  test("adds no route when chat is off", async () => {
    const off = new OpenAPIHono();
    chatRoutes(off, undefined, "dev");
    expect((await off.request("/chat", { method: "POST" })).status).toBe(404);
  });
});
