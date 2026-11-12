import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { captureLogs } from "../test/captureLogs";
import {
  correlationHeaders,
  logger,
  logLevel,
  logSecurityEvent,
  logTokenRejected,
  rejectionReason,
  requestContext,
} from "./logger";

let logs: ReturnType<typeof captureLogs>;

beforeEach(() => {
  logs = captureLogs();
});

afterEach(() => {
  logs.restore();
});

describe("logger", () => {
  test("writes the fields Cloud Logging reads", () => {
    logger.warn({ orgId: 42 }, "Something happened");
    const [line] = logs.lines;
    expect(line).toMatchObject({
      severity: "WARNING",
      message: "Something happened",
      logType: "app",
      orgId: 42,
      serviceContext: { service: expect.any(String) },
    });
    expect(Date.parse(String(line?.["time"]))).not.toBeNaN();
    expect(line).not.toContainKey("level");
    expect(line).not.toContainKey("pid");
  });

  test("maps every level to a Cloud Logging severity", () => {
    logger.debug("d");
    logger.info("i");
    logger.error("e");
    logger.fatal("f");
    expect(logs.lines.map((line) => line["severity"])).toEqual([
      "DEBUG",
      "INFO",
      "ERROR",
      "CRITICAL",
    ]);
  });

  test("logs only the safe fields of an error, with the stack in stack_trace", () => {
    const error = Object.assign(new Error("Request failed with status code 502"), {
      name: "AxiosError",
      code: "ERR_BAD_RESPONSE",
      status: 502,
      config: { headers: { Authorization: "Bearer secret-token" } },
      response: { data: { name: "Ola Nordmann" } },
      cause: "socket hang up",
    });
    logger.error({ err: error }, "Could not fetch");
    const [line] = logs.lines;
    expect(line?.["err"]).toEqual({
      type: "AxiosError",
      message: "Request failed with status code 502",
      code: "ERR_BAD_RESPONSE",
      status: 502,
      cause: { message: "socket hang up" },
    });
    expect(String(line?.["stack_trace"])).toStartWith("AxiosError: Request failed");
    expect(JSON.stringify(line)).not.toContain("secret-token");
    expect(JSON.stringify(line)).not.toContain("Ola Nordmann");
  });

  test("stops after a few causes when a cause points back to the error", () => {
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    first.cause = second;
    logger.error({ err: first }, "Loop");
    const err = logs.lines[0]?.["err"] as { cause: { cause: { cause: { cause?: unknown } } } };
    expect(err.cause.cause.cause).toMatchObject({ message: "second" });
    expect(err.cause.cause.cause.cause).toBeUndefined();
  });

  test("shortens a long message and a long stack", () => {
    const error = new Error("big");
    error.stack = "x".repeat(50_000);
    logger.error({ err: error }, "y".repeat(20_000));
    const [line] = logs.lines;
    expect(String(line?.["message"]).length).toBeLessThan(17_000);
    expect(String(line?.["stack_trace"]).length).toBeLessThan(25_000);
    expect(String(line?.["stack_trace"])).toEndWith("...[truncated]");
  });

  test("hides sensitive keys at the top level and one level down", () => {
    logger.info(
      {
        email: "a@example.com",
        user: { authorization: "Bearer x", id: 1, profile: { email: "b@example.com" } },
      },
      "m",
    );
    expect(logs.lines[0]).toMatchObject({
      email: "[REDACTED]",
      user: { authorization: "[REDACTED]", id: 1, profile: { email: "[REDACTED]" } },
    });
  });

  test("does not let a caller change the severity or the service", () => {
    logger.info({ severity: "ERROR", serviceContext: { service: "other" } }, "m");
    const [line] = logs.lines;
    expect(line?.["severity"]).toBe("INFO");
    expect(line?.["serviceContext"]).not.toEqual({ service: "other" });
  });
});

describe("correlation id", () => {
  test("is added to lines and outgoing headers inside a request", async () => {
    await requestContext.run({ correlationId: "abc-123" }, async () => {
      await Bun.sleep(1);
      logger.info("inside");
      expect(correlationHeaders()).toEqual({ "X-Correlation-Id": "abc-123" });
    });
    expect(logs.lines[0]?.["correlationId"]).toBe("abc-123");
  });

  test("is missing outside a request", () => {
    logger.info("outside");
    expect(logs.lines[0]).not.toContainKey("correlationId");
    expect(correlationHeaders()).toEqual({});
  });
});

test("logSecurityEvent logs a warning with logType security", () => {
  logSecurityEvent("token_rejected", { reason: "ERR_JWT_EXPIRED" }, "Rejected access token");
  expect(logs.lines[0]).toMatchObject({
    severity: "WARNING",
    logType: "security",
    securityEvent: { type: "token_rejected", reason: "ERR_JWT_EXPIRED" },
    message: "Rejected access token",
  });
});

describe("logTokenRejected", () => {
  test("logs the same rejection once a minute, and counts the ones it left out", () => {
    setSystemTime(new Date("2026-01-01T12:00:00Z"));
    for (let i = 0; i < 3; i++) logTokenRejected("bad", { route: "r" }, "Rejected");
    logTokenRejected("other", { route: "r" }, "Rejected");
    setSystemTime(new Date("2026-01-01T12:01:01Z"));
    logTokenRejected("bad", { route: "r" }, "Rejected");
    setSystemTime();

    expect(logs.lines.map((line) => line["securityEvent"])).toEqual([
      { type: "token_rejected", route: "r", reason: "bad" },
      { type: "token_rejected", route: "r", reason: "other" },
      { type: "token_rejected", route: "r", reason: "bad", skipped: 2 },
    ]);
  });
});

describe("logLevel", () => {
  test("accepts pino levels in any case, and warning", () => {
    expect(logLevel("debug")).toBe("debug");
    expect(logLevel("ERROR")).toBe("error");
    expect(logLevel(" Warning ")).toBe("warn");
    expect(logLevel("silent")).toBe("silent");
  });

  test("returns undefined for an unknown level", () => {
    expect(logLevel("verbose")).toBeUndefined();
  });
});

describe("rejectionReason", () => {
  test("uses the code of an error that has one, and keeps the message as detail", () => {
    const error = Object.assign(new Error('"exp" claim timestamp check failed'), {
      code: "ERR_JWT_EXPIRED",
    });
    expect(rejectionReason(error)).toEqual({
      reason: "ERR_JWT_EXPIRED",
      detail: '"exp" claim timestamp check failed',
    });
  });

  test("uses the message of an error without a code, and a string as it is", () => {
    expect(rejectionReason(new Error("missing token"))).toEqual({ reason: "missing token" });
    expect(rejectionReason("unknown issuer")).toEqual({ reason: "unknown issuer" });
  });
});
