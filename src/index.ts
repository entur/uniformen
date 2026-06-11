import { prometheus } from "@hono/prometheus";
import { OpenAPIHono } from "@hono/zod-openapi";
import { serveStatic } from "hono/bun";
import { previewRoutes } from "./ssr/preview";
import { uniformenSsrRoutes } from "./ssr/ssr";

export const app = new OpenAPIHono();

// Prometheus metrics
const { printMetrics, registerMetrics } = prometheus();
app.use("*", registerMetrics);
app.get("/actuator/prometheus", printMetrics);

// Health checks
app.get("/actuator/health/liveness", (c) => c.json({ status: "UP" }));
app.get("/actuator/health/readiness", (c) => c.json({ status: "UP" }));

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

export default {
  port: 4123,
  fetch: app.fetch,
};
