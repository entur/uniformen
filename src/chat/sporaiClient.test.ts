import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { MachineTokenProvider } from "../auth/machineToken";
import { INTERNAL_AUDIENCE } from "../test/authTestKeys";
import { machineTokenMock, SPORAI_SESSION_ID, sporaiMock } from "../test/authTestSetup";
import { SporaiClient } from "./sporaiClient";

const tokenOptions = {
  tokenUri: process.env["AUTH0_INTERNAL_TOKEN_URI"]!,
  clientId: process.env["MNG_AUTH0_INT_CLIENT_ID"]!,
  clientSecret: process.env["MNG_AUTH0_INT_CLIENT_SECRET"]!,
  audience: INTERNAL_AUDIENCE,
};

const question = { sessionId: "session-1", query: "Hva er en rolle?", rateLimitKey: "user-key" };

// A new token provider for every client, so the cached machine token does not carry over.
const newClient = (baseUrl = process.env["SPORAI_URL"]!) =>
  new SporaiClient({ baseUrl, tokens: new MachineTokenProvider(tokenOptions) }, { timeoutMs: 200 });

let client: SporaiClient;

beforeEach(() => {
  machineTokenMock.reset();
  sporaiMock.reset();
  client = newClient();
});

describe("machine token", () => {
  test("a failed fetch gives an error and sporai is not called", async () => {
    machineTokenMock.respond = () => new Response("nope", { status: 500 });
    expect(await client.chat(question)).toEqual({ kind: "error" });
    expect(sporaiMock.calls).toBe(0);

    machineTokenMock.reset();
    expect(await client.chat(question)).toEqual({ kind: "ok", reply: "svar" });
  });

  test.each([401, 403])(
    "is kept after sporai answers %i, so a problem with sporai does not cost Auth0 calls",
    async (status) => {
      sporaiMock.respond = () => new Response("no", { status });
      expect(await client.chat(question)).toEqual({ kind: "error" });

      sporaiMock.reset();
      expect(await client.chat(question)).toEqual({ kind: "ok", reply: "svar" });
      expect(machineTokenMock.calls).toBe(1);
    },
  );
});

describe("createSession", () => {
  test("returns the session id", async () => {
    expect(await client.createSession()).toEqual({ kind: "ok", sessionId: SPORAI_SESSION_ID });
  });

  test("a failed request gives an error", async () => {
    // This path does not exist on the fake server, so sporai answers 404.
    const broken = newClient(`${process.env["SPORAI_URL"]}/broken`);
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
    await newClient().chat(question);

    expect(logged.length).toBeGreaterThan(0);
    const output = logged.join("\n");
    expect(output).not.toContain(tokenOptions.clientSecret);
    expect(output).not.toContain("machine-token");
  });
});
