import { describe, expect, test } from "bun:test";
import { app } from "./index";
import { beginShutdown, isReady } from "./lifecycle";

describe("server", () => {
  test("liveness UP", async () => {
    const res = await app.request("/actuator/health/liveness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "UP" });
  });

  test("readiness UP", async () => {
    const res = await app.request("/actuator/health/readiness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "UP" });
  });

  test("root responds", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Entur");
  });
});

/**
 * A draining pod has to stop being sent traffic before it stops serving, or a
 * rollout answers whatever arrived in the same instant with a dropped connection.
 * Readiness is what says so, so it has to actually fail.
 *
 * Last in the file: the flip is one-way, as it is in a shutdown.
 */
describe("shutdown", () => {
  test("readiness fails once a shutdown has begun, and liveness does not", async () => {
    expect(isReady()).toBe(true);
    expect(beginShutdown()).toBe(true);

    const readiness = await app.request("/actuator/health/readiness");
    expect(readiness.status).toBe(503);
    expect(await readiness.json()).toEqual({ status: "OUT_OF_SERVICE" });

    // The process is up and still answering — that is what the drain is for — so
    // nothing should be restarting it, and requests still get a layout.
    const liveness = await app.request("/actuator/health/liveness");
    expect(liveness.status).toBe(200);
    const ssr = await app.request("/ssr");
    expect(ssr.status).toBe(200);
  });

  test("a second signal does not start a second drain", () => {
    expect(beginShutdown()).toBe(false);
  });
});
