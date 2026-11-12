import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";

// ETU-80540: Do not add uniformen-specific code to this folder. It will be moved to a
// shared package.

type RequestContext = { correlationId: string };

/** Holds the correlation id of the request that is running. */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Google Cloud Logging reads the level from `severity`, with these names. */
const SEVERITY: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

// Cloud Logging rejects a log entry over 256 KiB. The stack limit is the same as in
// entur/cloud-logging.
const MAX_MESSAGE_LENGTH = 16 * 1024;
const MAX_STACK_LENGTH = 24 * 1024;

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}...[truncated]` : text;

type ErrorWithDetails = Error & { code?: unknown; status?: unknown };

/** How many causes of an error are logged. A cause can point back to the error. */
const MAX_CAUSE_DEPTH = 3;

/**
 * Returns the fields of an error that are safe to log: type, message, code, status
 * and cause. It leaves out every other property, because errors from HTTP clients
 * can hold the request headers, including the Authorization header. The stack is
 * written to `stack_trace` instead, see `formatters.log` below.
 */
export function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) return { message: String(error) };
  const { name, message, code, status, cause } = error as ErrorWithDetails;
  return {
    type: name,
    message,
    code,
    status,
    cause:
      cause === undefined || depth >= MAX_CAUSE_DEPTH
        ? undefined
        : serializeError(cause, depth + 1),
  };
}

const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "token",
  "accessToken",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "clientSecret",
  "client_secret",
  "password",
  "email",
];

/**
 * Returns the pino level for a LOG_LEVEL value, or `undefined` for an unknown value.
 * It accepts upper case and "warning", which other Entur services use. pino throws
 * on an unknown level, and the service would not start. It is exported only for tests.
 */
export function logLevel(value: string): string | undefined {
  const level = value.trim().toLowerCase();
  if (level === "warning") return "warn";
  return level in SEVERITY || level === "silent" ? level : undefined;
}

const configuredLevel = process.env["LOG_LEVEL"];

/**
 * The stream the logger writes to. It writes to stdout without a buffer, so the last
 * lines are not lost when the process exits. It is exported only for tests.
 */
export const logDestination = pino.destination({ dest: 1, sync: true });

/**
 * Writes one JSON object per line to stdout, in the format Google Cloud Logging reads.
 *
 * Log an error as `logger.error({ err }, "What failed")`. Then the stack goes to
 * `stack_trace`, where Error Reporting finds it.
 */
export const logger = pino(
  {
    level: (configuredLevel && logLevel(configuredLevel)) || "info",
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    // Error Reporting groups errors by `serviceContext.service`. In Kubernetes,
    // OTEL_SERVICE_NAME holds the app name.
    base: { serviceContext: { service: process.env["OTEL_SERVICE_NAME"] ?? "unknown" } },
    serializers: { err: serializeError },
    // This only finds these keys up to two levels down. It does not find them deeper
    // in an object or inside the message text.
    redact: {
      paths: SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
      censor: "[REDACTED]",
    },
    formatters: {
      level: (label) => ({ severity: SEVERITY[label] ?? "DEFAULT" }),
      // pino calls this before the serializers, so `err` is still the Error here.
      log: (object) => {
        const stack = object["err"] instanceof Error ? object["err"].stack : undefined;
        // Remove the fields that Cloud Logging reads from the logger itself, so a
        // caller cannot change the level or the service by accident. A caller may set
        // `logType`.
        const { severity: _severity, serviceContext: _serviceContext, ...fields } = object;
        return {
          logType: "app",
          ...fields,
          ...(stack ? { stack_trace: truncate(stack, MAX_STACK_LENGTH) } : {}),
        };
      },
    },
    hooks: {
      logMethod(args, method) {
        // The message is the first argument, or the second when the first is an object.
        const index = typeof args[0] === "string" ? 0 : 1;
        const message = args[index];
        if (typeof message === "string") args[index] = truncate(message, MAX_MESSAGE_LENGTH);
        return method.apply(this, args);
      },
    },
    mixin: () => {
      const context = requestContext.getStore();
      return context ? { correlationId: context.correlationId } : {};
    },
  },
  logDestination,
);

if (configuredLevel && !logLevel(configuredLevel)) {
  logger.warn(`Unknown LOG_LEVEL "${configuredLevel}". Logging at info.`);
}

/** The kinds of security events. Add a kind here when the code logs a new one. */
type SecurityEventType = "token_rejected";

/**
 * Logs a security event as a warning with `logType: "security"`, so these events can
 * be found and sent on separately. Do not put tokens or personal data in `details`.
 */
export function logSecurityEvent(
  type: SecurityEventType,
  details: Record<string, unknown>,
  message: string,
): void {
  logger.warn({ logType: "security", securityEvent: { type, ...details } }, message);
}

const TOKEN_REJECTED_INTERVAL_MS = 60_000;

/** When each kind of rejected token was last logged, and how many were left out since. */
const tokenRejections = new Map<string, { loggedAt: number; skipped: number }>();

/**
 * Logs a `token_rejected` security event. It logs the same rejection (the same
 * message, details and reason) at most once a minute, because anyone can send bad
 * tokens to the public routes. The next line has `skipped`, the number of events
 * that were left out in between.
 */
export function logTokenRejected(
  error: unknown,
  details: Record<string, string | undefined>,
  message: string,
): void {
  const reason = rejectionReason(error);
  const key = JSON.stringify([message, details, reason.reason]);
  const now = Date.now();
  const last = tokenRejections.get(key);
  if (last && now - last.loggedAt < TOKEN_REJECTED_INTERVAL_MS) {
    last.skipped++;
    return;
  }
  // The keys come from our own code and from error codes, so there are few of them.
  // Clear the map anyway if it grows, so it cannot use much memory.
  if (tokenRejections.size >= 1000) tokenRejections.clear();
  tokenRejections.set(key, { loggedAt: now, skipped: 0 });
  logSecurityEvent(
    "token_rejected",
    { ...details, ...reason, ...(last?.skipped ? { skipped: last.skipped } : {}) },
    message,
  );
}

/** Forgets which rejected tokens were logged. It is exported only for tests. */
export function resetTokenRejections(): void {
  tokenRejections.clear();
}

/**
 * Returns the reason to log when a token is rejected. For an error with a code, such
 * as `ERR_JWT_EXPIRED`, the reason is the code and `detail` is the message, which
 * says, for example, which claim failed. For another error the reason is the
 * message, and for a string it is the string.
 */
export function rejectionReason(error: unknown): { reason: string; detail?: string } {
  if (!(error instanceof Error)) return { reason: String(error) };
  const { code } = error as ErrorWithDetails;
  return typeof code === "string"
    ? { reason: code, detail: error.message }
    : { reason: error.message };
}

/**
 * Returns the headers that pass the request's correlation id on to another Entur
 * service. Returns no headers outside a request.
 */
export function correlationHeaders(): Record<string, string> {
  const context = requestContext.getStore();
  return context ? { "X-Correlation-Id": context.correlationId } : {};
}

/**
 * Logs uncaught errors as one JSON line and stops the process. Without this, the
 * runtime prints the stack as plain text, and Cloud Logging splits it into one entry
 * per line.
 */
export function logUncaughtErrors(): void {
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
  });
}
