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
  help: "SSR layout renders, by app, locale and whether a user is authenticated or not",
  labelNames: ["consumer_app", "locale", "authenticated"],
  registers: [registry],
});

export { printMetrics, metricsRoute };
