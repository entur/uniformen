import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { app } from "../index";
import { userInfoMock } from "../test/authTestSetup";
import { signInternalToken } from "../test/authTestKeys";
import { config } from "../config";
import { UserInfoServiceImpl } from "./userInfo";

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => userInfoMock.reset());
// TTL tests below fake the clock instead of sleeping; restore it after each test.
afterEach(() => setSystemTime());

// NOTE: the app-level service caches by `tenant|sub` for the whole test run,
// so every end-to-end test below uses a distinct sub to avoid cache bleed.

describe("userinfo via /ssr (end-to-end)", () => {
  test("nickname is not used as a display name", async () => {
    userInfoMock.respond = () => Response.json({ nickname: "ada" });
    const token = await signInternalToken({ sub: "auth0|nickname-only" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    const body = await res.json();
    expect(body.headerHtml).not.toContain("ada");
    expect(body.headerHtml).toContain("Bruker uten navn");
  });

  test("falls back to email when name and nickname are missing", async () => {
    userInfoMock.respond = () => Response.json({ email: "ada@example.org" });
    const token = await signInternalToken({ sub: "auth0|email-only" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    const body = await res.json();
    expect(body.headerHtml).toContain("ada@example.org");
  });

  test("2xx with no name or email renders the placeholder", async () => {
    userInfoMock.respond = () => Response.json({});
    const token = await signInternalToken({ sub: "auth0|empty-body" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain("Bruker uten navn");
  });

  test("sequential requests for the same user hit upstream once (cache)", async () => {
    const token = await signInternalToken({ sub: "auth0|cache-hit" });
    await app.request("/ssr", { headers: bearer(token) });
    await app.request("/ssr", { headers: bearer(token) });
    expect(userInfoMock.calls).toBe(1);
  });

  test("concurrent requests for the same user share one in-flight fetch", async () => {
    userInfoMock.respond = async () => {
      // Just long enough that both requests (fired in the same tick) overlap
      // the in-flight window.
      await Bun.sleep(10);
      return Response.json({ name: "Slow Ada" });
    };
    const token = await signInternalToken({ sub: "auth0|in-flight" });
    const [a, b] = await Promise.all([
      app.request("/ssr", { headers: bearer(token) }),
      app.request("/ssr", { headers: bearer(token) }),
    ]);
    expect((await a.json()).headerHtml).toContain("Slow Ada");
    expect((await b.json()).headerHtml).toContain("Slow Ada");
    expect(userInfoMock.calls).toBe(1);
  });

  test("failures are negative-cached: second request does not re-hit upstream", async () => {
    userInfoMock.respond = () => new Response("nope", { status: 429 });
    const token = await signInternalToken({ sub: "auth0|negative-cache" });
    const first = await app.request("/ssr", { headers: bearer(token) });
    const second = await app.request("/ssr", { headers: bearer(token) });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).headerHtml).not.toContain("uniformen-top-nav__user");
    expect(userInfoMock.calls).toBe(1);
  });

  test("no token means no upstream call and anonymous nav", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);
    expect((await res.json()).headerHtml).not.toContain("uniformen-top-nav__user");
    expect(userInfoMock.calls).toBe(0);
  });
});

describe("UserInfoServiceImpl (unit)", () => {
  test("returns the full userinfo object including custom claims", async () => {
    userInfoMock.respond = () =>
      Response.json({
        sub: "waad|full-object",
        given_name: "Hallstein",
        family_name: "Bronskimlet",
        nickname: "hallstein.bronskimlet",
        name: "Hallstein Bronskimlet",
        email: "hallstein.bronskimlet@entur.org",
        email_verified: true,
        "https://entur.io/organisationID": 1,
      });
    const service = new UserInfoServiceImpl(config.tenants);
    const token = await signInternalToken();
    const info = await service.getUserInfo("internal", token, "waad|full-object");
    expect(info?.name).toBe("Hallstein Bronskimlet");
    expect(info?.email).toBe("hallstein.bronskimlet@entur.org");
    expect(info?.["https://entur.io/organisationID"]).toBe(1);
  });

  test("positive TTL expiry triggers a re-fetch", async () => {
    const service = new UserInfoServiceImpl(config.tenants, { positiveTtlMs: 10 });
    const token = await signInternalToken();
    const info = await service.getUserInfo("internal", token, "ttl|positive");
    expect(info?.name).toBe("Hallstein Bronskimlet");
    setSystemTime(new Date(Date.now() + 11)); // jump past the TTL, no sleep
    await service.getUserInfo("internal", token, "ttl|positive");
    expect(userInfoMock.calls).toBe(2);
  });

  test("negative TTL expiry triggers a re-fetch", async () => {
    userInfoMock.respond = () => new Response("boom", { status: 500 });
    const service = new UserInfoServiceImpl(config.tenants, { negativeTtlMs: 10 });
    const token = await signInternalToken();
    expect(await service.getUserInfo("internal", token, "ttl|negative")).toBeUndefined();
    expect(await service.getUserInfo("internal", token, "ttl|negative")).toBeUndefined();
    expect(userInfoMock.calls).toBe(1); // within negative TTL: cached
    setSystemTime(new Date(Date.now() + 11)); // jump past the TTL, no sleep
    await service.getUserInfo("internal", token, "ttl|negative");
    expect(userInfoMock.calls).toBe(2);
  });

  test("timeout resolves to undefined instead of throwing", async () => {
    userInfoMock.respond = async () => {
      await Bun.sleep(200);
      return Response.json({ name: "Too Late" });
    };
    const service = new UserInfoServiceImpl(config.tenants, { timeoutMs: 20 });
    const token = await signInternalToken();
    expect(await service.getUserInfo("internal", token, "timeout|user")).toBeUndefined();
  });

  test("maxEntries evicts the oldest entry", async () => {
    const service = new UserInfoServiceImpl(config.tenants, { maxEntries: 2 });
    const token = await signInternalToken();
    await service.getUserInfo("internal", token, "evict|1");
    await service.getUserInfo("internal", token, "evict|2");
    await service.getUserInfo("internal", token, "evict|3"); // evicts evict|1
    expect(userInfoMock.calls).toBe(3);
    await service.getUserInfo("internal", token, "evict|2"); // still cached
    expect(userInfoMock.calls).toBe(3);
    await service.getUserInfo("internal", token, "evict|1"); // evicted: re-fetch
    expect(userInfoMock.calls).toBe(4);
  });

  test("unknown tenant returns undefined without fetching", async () => {
    const service = new UserInfoServiceImpl([]);
    expect(await service.getUserInfo("internal", "token", "any|sub")).toBeUndefined();
    expect(userInfoMock.calls).toBe(0);
  });
});
