import { afterEach, beforeEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { INTERNAL_AUDIENCE } from "../test/authTestKeys";
import { machineTokenMock, SPORAI_SESSION_ID, sporaiMock } from "../test/authTestSetup";
import { SporaiClient } from "./sporaiClient";

const config = {
  baseUrl: process.env["SPORAI_URL"]!,
  tokenUri: process.env["AUTH0_INTERNAL_TOKEN_URI"]!,
  clientId: process.env["MNG_AUTH0_INT_CLIENT_ID"]!,
  clientSecret: process.env["MNG_AUTH0_INT_CLIENT_SECRET"]!,
  audience: INTERNAL_AUDIENCE,
};

const question = { sessionId: "session-1", query: "Hva er en rolle?", rateLimitKey: "user-key" };

// Moves the clock forward, so tests do not have to wait for a token to expire.
const advance = (ms: number) => setSystemTime(new Date(Date.now() + ms));

let client: SporaiClient;

beforeEach(() => {
  machineTokenMock.reset();
  sporaiMock.reset();
  // A new client for every test, so the cached machine token does not carry over.
  client = new SporaiClient(config, { timeoutMs: 200 });
});

afterEach(() => setSystemTime());

describe("machine token", () => {
  test("is fetched once for parallel calls", async () => {
    await Promise.all([client.chat(question), client.chat(question)]);
    expect(machineTokenMock.calls).toBe(1);
    expect(sporaiMock.calls).toBe(2);
  });

  test("is reused until shortly before it expires", async () => {
    await client.chat(question);
    advance(3_000_000);
    await client.chat(question);
    expect(machineTokenMock.calls).toBe(1);

    // The 3,600 s lifetime minus the 60 s safety margin has now passed.
    advance(600_000);
    await client.chat(question);
    expect(machineTokenMock.calls).toBe(2);
  });

  test("is cached for 5 minutes when Auth0 sends no expires_in", async () => {
    machineTokenMock.respond = () => Response.json({ access_token: "machine-token" });
    await client.chat(question);
    await client.chat(question);
    expect(machineTokenMock.calls).toBe(1);

    // The 300 s default lifetime minus the 60 s safety margin has now passed.
    advance(300_000);
    await client.chat(question);
    expect(machineTokenMock.calls).toBe(2);
  });

  test("is requested with the client credentials and the audience", async () => {
    let body: unknown;
    machineTokenMock.respond = async (req) => {
      body = await req.json();
      return Response.json({ access_token: "machine-token", expires_in: 3600 });
    };
    await client.chat(question);
    expect(body).toEqual({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: config.audience,
    });
  });

  test("a failed fetch gives an error and is not cached", async () => {
    machineTokenMock.respond = () => new Response("nope", { status: 500 });
    expect(await client.chat(question)).toEqual({ kind: "error" });
    expect(sporaiMock.calls).toBe(0);

    machineTokenMock.reset();
    expect(await client.chat(question)).toEqual({ kind: "ok", reply: "svar" });
  });

  test("a response without access_token gives an error", async () => {
    machineTokenMock.respond = () => Response.json({ expires_in: 3600 });
    expect(await client.chat(question)).toEqual({ kind: "error" });
  });

  test("is dropped after sporai answers 401, so the next call fetches a new one", async () => {
    sporaiMock.respond = () => new Response("no", { status: 401 });
    expect(await client.chat(question)).toEqual({ kind: "error" });

    sporaiMock.reset();
    expect(await client.chat(question)).toEqual({ kind: "ok", reply: "svar" });
    expect(machineTokenMock.calls).toBe(2);
  });
});

describe("createSession", () => {
  test("returns the session id", async () => {
    expect(await client.createSession()).toEqual({ kind: "ok", sessionId: SPORAI_SESSION_ID });
  });

  test("a failed request gives an error", async () => {
    // This path does not exist on the fake server, so sporai answers 404.
    const broken = new SporaiClient(
      { ...config, baseUrl: `${config.baseUrl}/broken` },
      { timeoutMs: 200 },
    );
    expect(await broken.createSession()).toEqual({ kind: "error" });
  });
});

describe("chat", () => {
  test("returns the reply text", async () => {
    expect(await client.chat(question)).toEqual({ kind: "ok", reply: "svar" });
  });

  test("sends the machine token, the rate limit key header and the question as JSON", async () => {
    const seen: { authorization?: string | null; rateLimitKey?: string | null; body?: unknown } =
      {};
    sporaiMock.respond = async (req) => {
      seen.authorization = req.headers.get("authorization");
      seen.rateLimitKey = req.headers.get("rate-limit-key");
      seen.body = await req.json();
      return new Response("svar");
    };
    await client.chat({ ...question, location: "/turnover/point-of-sales" });
    expect(seen.authorization).toBe("Bearer machine-token");
    expect(seen.rateLimitKey).toBe("user-key");
    expect(seen.body).toEqual({
      sessionId: "session-1",
      query: "Hva er en rolle?",
      location: "/turnover/point-of-sales",
    });
  });

  test("sporai 404 means the session is gone", async () => {
    sporaiMock.respond = () => new Response("no", { status: 404 });
    expect(await client.chat(question)).toEqual({ kind: "sessionGone" });
  });

  test("sporai 429 means the user is rate limited", async () => {
    sporaiMock.respond = () => new Response("slow down", { status: 429 });
    expect(await client.chat(question)).toEqual({ kind: "rateLimited" });
  });

  test("sporai 429 gives the seconds to wait from Retry-After", async () => {
    sporaiMock.respond = () =>
      new Response("slow down", { status: 429, headers: { "Retry-After": "42" } });
    expect(await client.chat(question)).toEqual({ kind: "rateLimited", retryAfterSeconds: 42 });
  });

  test.each(["0", "-5", "soon", "1.5", ""])(
    "sporai 429 with Retry-After %j gives no seconds",
    async (retryAfter) => {
      sporaiMock.respond = () =>
        new Response("slow down", { status: 429, headers: { "Retry-After": retryAfter } });
      expect(await client.chat(question)).toStrictEqual({
        kind: "rateLimited",
        retryAfterSeconds: undefined,
      });
    },
  );

  test.each([400, 403, 500])("sporai %i gives an error", async (status) => {
    sporaiMock.respond = () => new Response("no", { status });
    expect(await client.chat(question)).toEqual({ kind: "error" });
  });

  test("a slow sporai gives an error", async () => {
    sporaiMock.respond = async () => {
      await Bun.sleep(400);
      return new Response("svar");
    };
    expect(await client.chat(question)).toEqual({ kind: "error" });
  });

  test("a timeout while the reply is still arriving gives an error", async () => {
    sporaiMock.respond = () =>
      new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(new TextEncoder().encode("sv"));
            await Bun.sleep(400);
            controller.close();
          },
        }),
      );
    expect(await client.chat(question)).toEqual({ kind: "error" });
  });

  test("a reply that is too long gives an error", async () => {
    sporaiMock.respond = () => new Response("x".repeat(8_001));
    expect(await client.chat(question)).toEqual({ kind: "error" });
  });

  test("an aborted request gives an error and does not throw", async () => {
    const controller = new AbortController();
    const pending = client.chat(question, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ kind: "error" });
  });
});

describe("logging", () => {
  const logged: string[] = [];
  const spies: ReturnType<typeof spyOn>[] = [];

  beforeEach(() => {
    logged.length = 0;
    for (const method of ["info", "warn", "error"] as const) {
      spies.push(
        spyOn(console, method).mockImplementation((...args) => void logged.push(args.join(" "))),
      );
    }
  });

  afterEach(() => {
    for (const spy of spies.splice(0)) spy.mockRestore();
  });

  test("never contains the client secret or a token", async () => {
    sporaiMock.respond = () => new Response("no", { status: 401 });
    await client.chat(question);
    machineTokenMock.respond = () => new Response("no", { status: 500 });
    await new SporaiClient(config, { timeoutMs: 200 }).chat(question);

    expect(logged.length).toBeGreaterThan(0);
    const output = logged.join("\n");
    expect(output).not.toContain(config.clientSecret);
    expect(output).not.toContain("machine-token");
  });
});
