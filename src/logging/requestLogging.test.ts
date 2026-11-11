import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { app } from "../index";
import { issueChatToken, chatProxyConfig } from "../chat/chatProxy";
import { SporaiClient } from "../chat/sporaiClient";
import { signInternalToken } from "../test/authTestKeys";
import { notificationMock, sporaiMock, userInfoMock } from "../test/authTestSetup";
import { captureLogs } from "../test/captureLogs";

let logs: ReturnType<typeof captureLogs>;

beforeEach(() => {
  logs = captureLogs();
  notificationMock.reset();
  sporaiMock.reset();
  userInfoMock.reset();
});

afterEach(() => {
  logs.restore();
});

const accessLines = () => logs.lines.filter((line) => line["logType"] === "access");

describe("access log", () => {
  test("logs one line per request, without the query string", async () => {
    const res = await app.request("/ssr?app=bedrift&loginUrl=/login");
    expect(res.status).toBe(200);
    expect(accessLines()).toEqual([
      expect.objectContaining({
        severity: "INFO",
        message: "GET /ssr 200",
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        httpRequest: {
          requestMethod: "GET",
          requestUrl: "/ssr",
          status: 200,
          latency: expect.stringMatching(/^\d+\.\d{3}s$/),
        },
      }),
    ]);
  });

  test("logs a 4xx as a warning", async () => {
    expect((await app.request("/ssr?loginUrl=https://example.com")).status).toBe(400);
    expect(accessLines()[0]?.["severity"]).toBe("WARNING");
  });

  test("keeps the status and body of an HTTPException", async () => {
    const res = await app.request("/notifications-proxy", { method: "POST" });
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Missing token");
    expect(accessLines()[0]?.["severity"]).toBe("WARNING");
  });

  test("does not log health checks, metrics, static files or CORS preflight requests", async () => {
    await app.request("/actuator/health/liveness");
    await app.request("/actuator/prometheus");
    await app.request("/static/does-not-exist.js");
    await app.request("/chat-proxy", { method: "OPTIONS" });
    expect(accessLines()).toEqual([]);
  });

  test("logs an unexpected error once, with the stack, and keeps the response", async () => {
    const chat = spyOn(SporaiClient.prototype, "chat").mockRejectedValue(new Error("boom"));
    const console = spyOn(globalThis.console, "error");
    try {
      const chatToken = await issueChatToken(chatProxyConfig, "auth0|request-logging");
      const res = await app.request("/chat-proxy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chatToken?.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "Hei" }),
      });
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain("boom");
    } finally {
      chat.mockRestore();
      console.mockRestore();
    }
    expect(console).not.toHaveBeenCalled();
    const errors = logs.lines.filter((line) => line["severity"] === "ERROR");
    expect(errors).toEqual([
      expect.objectContaining({
        logType: "access",
        message: "POST /chat-proxy 500",
        err: { type: "Error", message: "boom" },
        stack_trace: expect.stringContaining("Error: boom"),
      }),
    ]);
  });
});

describe("correlation id", () => {
  test("uses a valid X-Correlation-Id and sends it to the notification center, not Auth0", async () => {
    let received: string | null | undefined;
    let sentToAuth0: string | null | undefined;
    notificationMock.respond = (req) => {
      received = req.headers.get("X-Correlation-Id");
      return Response.json([]);
    };
    userInfoMock.respond = (req) => {
      sentToAuth0 = req.headers.get("X-Correlation-Id");
      return Response.json({ sub: "auth0|correlation-forwarded" });
    };
    const token = await signInternalToken({ sub: "auth0|correlation-forwarded" });
    await app.request("/ssr", {
      headers: { Authorization: `Bearer ${token}`, "X-Correlation-Id": "abc-123" },
    });
    expect(received).toBe("abc-123");
    expect(sentToAuth0).toBeNull();
    expect(accessLines()[0]?.["correlationId"]).toBe("abc-123");
  });

  test("is sent on to sporai", async () => {
    let received: string | null | undefined;
    sporaiMock.respond = (req) => {
      received = req.headers.get("X-Correlation-Id");
      return new Response("svar");
    };
    const chatToken = await issueChatToken(chatProxyConfig, "auth0|correlation-sporai");
    const res = await app.request("/chat-proxy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chatToken?.token}`,
        "Content-Type": "application/json",
        "X-Correlation-Id": "chat-123",
      },
      body: JSON.stringify({ query: "Hei" }),
    });
    expect(res.status).toBe(200);
    expect(received).toBe("chat-123");
  });

  test("replaces an invalid X-Correlation-Id with a new one", async () => {
    await app.request("/ssr", { headers: { "X-Correlation-Id": "Not valid <script>" } });
    expect(accessLines()[0]?.["correlationId"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("security events", () => {
  test("logs a rejected access token without the token, and still renders the bar", async () => {
    const token = await signInternalToken({ sub: "auth0|expired", exp: 1 });
    const res = await app.request("/ssr", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(logs.lines.filter((line) => line["logType"] === "security")).toEqual([
      expect.objectContaining({
        severity: "WARNING",
        message: "Rejected access token",
        securityEvent: {
          type: "token_rejected",
          tenant: "internal",
          reason: expect.stringContaining("ERR_JWT_EXPIRED"),
        },
      }),
    ]);
    expect(JSON.stringify(logs.lines)).not.toContain(token);
  });

  test("does not log a missing access token", async () => {
    await app.request("/ssr");
    expect(logs.lines.filter((line) => line["logType"] === "security")).toEqual([]);
  });

  test("logs a rejected chat token", async () => {
    const res = await app.request("/chat-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer not-a-token", "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Hei" }),
    });
    expect(res.status).toBe(401);
    expect(logs.lines.find((line) => line["logType"] === "security")).toMatchObject({
      securityEvent: { type: "token_rejected", route: "chat-proxy", reason: "ERR_JWS_INVALID" },
    });
  });
});
