import { OpenAPIHono } from "@hono/zod-openapi";
import { serveStatic } from "hono/bun";
import { beginShutdown, isReady } from "./lifecycle";
import { previewRoutes } from "./ssr/preview";
import { uniformenSsrRoutes } from "./ssr/ssr";
import { printMetrics, metricsRoute } from "./metrics";

export const app = new OpenAPIHono();

const PORT = 4123;

/**
 * How long the server keeps accepting requests after SIGTERM.
 *
 * Kubernetes stops routing to a pod and sends SIGTERM at about the same time, so
 * requests can still arrive for a short while after the signal. Serving them
 * means no requests fail during a rollout. The whole shutdown must finish within
 * Kubernetes' 30-second grace period.
 */
const SHUTDOWN_DRAIN_MS = 5_000;

/** How long open requests get to finish before their connections are closed. */
const SHUTDOWN_STOP_MS = 10_000;

app.use("*", metricsRoute);
app.get("/actuator/prometheus", printMetrics);

// Liveness says the process is running. Readiness says the pod should get
// traffic, and it fails as soon as shutdown starts.
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

// Only start the server when this file is run directly. Tests import `app`
// without starting a server.
if (import.meta.main) {
  const server = Bun.serve({ port: PORT, fetch: app.fetch });

  /**
   * Fails readiness, keeps serving for `SHUTDOWN_DRAIN_MS`, then stops accepting
   * new connections and lets open requests finish. Without this, requests that
   * arrive during a rollout would get a dropped connection.
   */
  const shutdown = async (signal: string) => {
    if (!beginShutdown()) return;
    console.info(`${signal} received, draining for ${SHUTDOWN_DRAIN_MS}ms`);
    await Bun.sleep(SHUTDOWN_DRAIN_MS);
    // Wait for open requests to finish, but at most `SHUTDOWN_STOP_MS`. Then close
    // all connections, so a connection that never ends does not keep the pod alive.
    await Promise.race([server.stop(), Bun.sleep(SHUTDOWN_STOP_MS)]);
    await server.stop(true);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
