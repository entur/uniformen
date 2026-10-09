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
 * The most client versions that get their own label value. Anyone can send the
 * header, and each new value creates a metric series that is kept for as long as
 * the process runs. This limit keeps the number of series small.
 */
export const MAX_CLIENT_VERSIONS = 50;

const seenClientVersions = new Set<string>();

/**
 * Returns the package version from the `X-Uniformen-Client` header, for example
 * `0.15.0`. Returns "none" when the header is missing and "unknown" when it has
 * another format. When `MAX_CLIENT_VERSIONS` versions have been seen, it returns
 * "other" for any new version.
 */
export function clientVersionLabel(header: string | undefined): string {
  if (header === undefined) return "none";
  const version = /^@entur\/uniformen@(\d+\.\d+\.\d+)$/.exec(header)?.[1];
  if (!version) return "unknown";
  if (seenClientVersions.has(version)) return version;
  if (seenClientVersions.size >= MAX_CLIENT_VERSIONS) return "other";
  seenClientVersions.add(version);
  return version;
}

export { printMetrics, metricsRoute };
