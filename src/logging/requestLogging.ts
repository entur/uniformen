import { createMiddleware } from "hono/factory";
import { logger, requestContext } from "./logger";

// The same rule as entur/cloud-logging uses: lowercase letters, digits and dashes.
const CORRELATION_ID = /^[0-9a-z-]{1,64}$/;

/**
 * Logs one line for each request, with the method, path, status and how long it
 * took. A 5xx is logged as an error and a 4xx as a warning. When a handler threw an
 * error, the line also has the error and its stack.
 *
 * It also gives the request a correlation id. It uses the `X-Correlation-Id` header
 * when the value is valid, and makes a new id when it is not. The id is added to
 * every line the request logs.
 *
 * Requests for which `skip` returns true are only logged when they fail with a 5xx.
 * The query string is never logged, because it can hold personal data.
 */
export const requestLogging = (skip: (method: string, path: string) => boolean = () => false) =>
  createMiddleware((c, next) => {
    const header = c.req.header("X-Correlation-Id");
    const correlationId = header && CORRELATION_ID.test(header) ? header : crypto.randomUUID();
    const start = performance.now();

    // Log inside `run`, so the line also gets the correlation id.
    return requestContext.run({ correlationId }, async () => {
      await next();
      const { method, path } = c.req;
      const status = c.res.status;
      if (status < 500 && skip(method, path)) return;

      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      logger[level](
        {
          logType: "access",
          httpRequest: {
            requestMethod: method,
            requestUrl: path,
            status,
            userAgent: c.req.header("User-Agent"),
            latency: `${((performance.now() - start) / 1000).toFixed(3)}s`,
          },
          ...(status >= 500 && c.error ? { err: c.error } : {}),
        },
        `${method} ${path} ${status}`,
      );
    });
  });
