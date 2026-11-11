import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { captureLogs } from "../test/captureLogs";
import { correlationHeaders, logger, logSecurityEvent, requestContext } from "./logger";

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
    logger.info({ email: "a@example.com", user: { authorization: "Bearer x", id: 1 } }, "m");
    expect(logs.lines[0]).toMatchObject({
      email: "[REDACTED]",
      user: { authorization: "[REDACTED]", id: 1 },
    });
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
