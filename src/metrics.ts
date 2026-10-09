import { prometheus } from "@hono/prometheus";
import { createMiddleware } from "hono/factory";
import { routePath } from "hono/route";
import { Counter, Registry } from "prom-client";

const registry = new Registry();

const { printMetrics, registerMetrics } = prometheus({
  registry,
  collectDefaultMetrics: true,
  metricOptions: {
    requestDuration: {
      // Use this name instead of 'http_request_duration_seconds', as described in
      // entur/ai observability.md.
      name: "http_server_requests_seconds",
      customLabels: { uri: (c) => routePath(c) },
    },
    requestsTotal: { disabled: true },
  },
});

const metricsRoute = createMiddleware((c, next) =>
  // Do not count requests to the /actuator endpoints.
  c.req.path.startsWith("/actuator") ? next() : registerMetrics(c, next),
);

export const ssrRequestMetric = new Counter({
  name: "uniformen_ssr_requests",
  help: "SSR layout renders, by app, locale, whether a user is authenticated or not, and client package version",
  labelNames: ["consumer_app", "locale", "authenticated", "client_version"],
  registers: [registry],
});

/**
 * Returns the package version from the `X-Uniformen-Client` header, for example
 * `0.15.0`. Returns "none" when the header is missing and "unknown" when it has
 * another format. Anyone can send the header, so only a version number becomes a
 * label value. Free text would create a new metric series for every value.
 */
export function clientVersionLabel(header: string | undefined): string {
  if (header === undefined) return "none";
  const match = /^@entur\/uniformen@(\d+\.\d+\.\d+)$/.exec(header);
  return match?.[1] ?? "unknown";
}

export { printMetrics, metricsRoute };
