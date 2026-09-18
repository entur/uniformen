import { OpenAPIHono } from "@hono/zod-openapi";
import { serveStatic } from "hono/bun";
import { beginShutdown, isReady } from "./lifecycle";
import { previewRoutes } from "./ssr/preview";
import { uniformenSsrRoutes } from "./ssr/ssr";
import { printMetrics, metricsRoute } from "./metrics";

export const app = new OpenAPIHono();

const PORT = 4123;

/**
 * How long a pod keeps serving after SIGTERM before it stops accepting.
 *
 * Deleting a pod stops routing to it and signals it at roughly the same moment, so
 * requests keep arriving for a little while after the signal. Serving through that
 * window is what makes a rollout invisible to consumers. Well inside Kubernetes'
 * 30-second grace period, which is the ceiling on the whole shutdown.
 */
const SHUTDOWN_DRAIN_MS = 5_000;

/** How long in-flight requests get to finish before the socket is closed on them. */
const SHUTDOWN_STOP_MS = 10_000;

// Prometheus metrics
app.use("*", metricsRoute);
app.get("/actuator/prometheus", printMetrics);

// Health checks. Liveness is "this process is alive"; readiness is "send me
// traffic", which stops being true as soon as the pod starts draining.
app.get("/actuator/health/liveness", (c) => c.json({ status: "UP" }));
app.get("/actuator/health/readiness", (c) =>
  isReady() ? c.json({ status: "UP" }) : c.json({ status: "OUT_OF_SERVICE" }, 503),
);

app.use("/static/*", serveStatic({ root: "./src" }));

uniformenSsrRoutes(app);
previewRoutes(app);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Uniformen",
  },
});

// Served when this file is the entrypoint, so importing it — from a test — costs
// nothing but the routes.
if (import.meta.main) {
  const server = Bun.serve({ port: PORT, fetch: app.fetch });

  /**
   * Fail readiness, keep serving through the drain, then stop accepting and let
   * what is already in flight finish. Without it a rollout answers whatever arrived
   * in the same instant with a dropped connection — and every consuming app's page
   * render is one of those requests.
   */
  const shutdown = async (signal: string) => {
    if (!beginShutdown()) return;
    console.info(`${signal} received, draining for ${SHUTDOWN_DRAIN_MS}ms`);
    await Bun.sleep(SHUTDOWN_DRAIN_MS);
    // Graceful first, then forced: a connection that won't end must not hold the
    // pod until the kubelet kills it.
    await Promise.race([server.stop(), Bun.sleep(SHUTDOWN_STOP_MS)]);
    await server.stop(true);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
