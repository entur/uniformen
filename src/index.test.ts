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

// Keep this block last in the file. Nothing resets the shutdown state, so every
// test after it would see a server that is shutting down.
describe("shutdown", () => {
  test("readiness fails once a shutdown has begun, and liveness does not", async () => {
    expect(isReady()).toBe(true);
    expect(beginShutdown()).toBe(true);

    const readiness = await app.request("/actuator/health/readiness");
    expect(readiness.status).toBe(503);
    expect(await readiness.json()).toEqual({ status: "OUT_OF_SERVICE" });

    const liveness = await app.request("/actuator/health/liveness");
    expect(liveness.status).toBe(200);
    const ssr = await app.request("/ssr");
    expect(ssr.status).toBe(200);
  });

  test("a second signal does not start a second drain", () => {
    expect(beginShutdown()).toBe(false);
  });
});
