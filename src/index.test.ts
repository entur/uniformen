import { describe, expect, test } from "bun:test";
import { app } from "./index";

describe("server", () => {
  test("liveness UP", async () => {
    const res = await app.request("/actuator/health/liveness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "UP" });
  });

  test("root responds", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hei Uniformen!");
  });
});
