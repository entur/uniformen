import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import {
  INTERNAL_AUDIENCE,
  INTERNAL_ISSUER,
  PARTNER_AUDIENCE,
  PARTNER_ISSUER,
  signPartnerToken,
  signInternalToken,
} from "../test/authTestKeys";
import type { AuthTenant } from "../config";
import { createOptionalAuth } from "./optionalAuth";
import { createValidateJwt, validateJwt } from "./validateJwt";

const app = new Hono();
app.use("/protected", validateJwt);
app.get("/protected", (c) => c.json({ tenant: c.get("authTenant") }));

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Asserts a 401 with the given RFC 6750 error code and description. */
function expectUnauthorized(res: Response, error: string, description: string) {
  expect(res.status).toBe(401);
  const header = res.headers.get("WWW-Authenticate") ?? "";
  expect(header).toContain(`error="${error}"`);
  expect(header).toContain(`error_description="${description}"`);
}

describe("validateJwt (strict)", () => {
  test("valid internal token returns 200 with tenant name", async () => {
    const token = await signInternalToken();
    const res = await app.request("/protected", { headers: bearer(token) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenant: "internal" });
  });

  test("valid partner token returns 200 with tenant name", async () => {
    const token = await signPartnerToken();
    const res = await app.request("/protected", { headers: bearer(token) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenant: "partner" });
  });

  test("bearer scheme is case-insensitive", async () => {
    const token = await signInternalToken();
    const res = await app.request("/protected", {
      headers: { Authorization: `bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  test("missing Authorization header is rejected", async () => {
    const res = await app.request("/protected");
    expectUnauthorized(res, "invalid_request", "no authorization included in request");
  });

  test("non-Bearer scheme is rejected even with a valid token", async () => {
    const token = await signInternalToken();
    const res = await app.request("/protected", {
      headers: { Authorization: `Basic ${token}` },
    });
    expectUnauthorized(res, "invalid_request", "invalid credentials structure");
  });

  test("malformed token is rejected", async () => {
    const res = await app.request("/protected", { headers: bearer("not-a-jwt") });
    expectUnauthorized(res, "invalid_token", "token decoding failure");
  });

  test("token from an unknown issuer is rejected", async () => {
    const token = await signInternalToken({ iss: "https://evil.example/" });
    const res = await app.request("/protected", { headers: bearer(token) });
    expectUnauthorized(res, "invalid_token", "unknown token issuer");
  });

  test("token without an iss claim is rejected", async () => {
    const token = await signInternalToken({ iss: undefined });
    const res = await app.request("/protected", { headers: bearer(token) });
    expectUnauthorized(res, "invalid_token", "unknown token issuer");
  });

  test("cross-paired token (partner key, internal issuer) is rejected with 401", async () => {
    const token = await signPartnerToken({ iss: INTERNAL_ISSUER, aud: INTERNAL_AUDIENCE });
    const res = await app.request("/protected", { headers: bearer(token) });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
  });

  test("expired token is rejected", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signInternalToken({ iat: now - 7200, exp: now - 3600 });
    const res = await app.request("/protected", { headers: bearer(token) });
    expectUnauthorized(res, "invalid_token", "token verification failure");
  });

  test("token without an exp claim is rejected", async () => {
    const token = await signInternalToken({ exp: undefined });
    const res = await app.request("/protected", { headers: bearer(token) });
    expectUnauthorized(res, "invalid_token", "token verification failure");
  });

  test("token with the wrong audience is rejected", async () => {
    const token = await signInternalToken({ aud: "https://other.example" });
    const res = await app.request("/protected", { headers: bearer(token) });
    expectUnauthorized(res, "invalid_token", "token verification failure");
  });
});

describe("validateJwt (multiple audiences)", () => {
  const SECOND_AUDIENCE = "https://api.uniformen.test";

  const multiAudiencePartner: AuthTenant = {
    name: "partner",
    issuer: PARTNER_ISSUER,
    audience: [PARTNER_AUDIENCE, SECOND_AUDIENCE],
    // authTestSetup sets these variables to URLs on the local test server.
    jwksUri: process.env["AUTH0_PARTNER_JWKS_URI"]!,
    userInfoUri: process.env["AUTH0_PARTNER_USERINFO_URI"]!,
  };

  function appWithMultiAudience() {
    const a = new Hono();
    a.use("/protected", createValidateJwt([multiAudiencePartner]));
    a.get("/protected", (c) => c.json({ tenant: c.get("authTenant") }));
    return a;
  }

  test("accepts a token for either configured audience", async () => {
    const a = appWithMultiAudience();
    for (const aud of [PARTNER_AUDIENCE, SECOND_AUDIENCE]) {
      const token = await signPartnerToken({ aud });
      const res = await a.request("/protected", { headers: bearer(token) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ tenant: "partner" });
    }
  });

  test("accepts a token whose aud array contains one configured audience", async () => {
    const a = appWithMultiAudience();
    const token = await signPartnerToken({ aud: [PARTNER_AUDIENCE, "https://extra.example"] });
    const res = await a.request("/protected", { headers: bearer(token) });
    expect(res.status).toBe(200);
  });

  test("still rejects an audience not in the list", async () => {
    const a = appWithMultiAudience();
    const token = await signPartnerToken({ aud: "https://not-allowed.example" });
    const res = await a.request("/protected", { headers: bearer(token) });
    expectUnauthorized(res, "invalid_token", "token verification failure");
  });
});

/** Starts a JWKS server that answers with `respond(hit)` and counts the requests. */
function jwksServer(respond: (hit: number) => Response) {
  let hits = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => respond(++hits),
  });
  return {
    url: `http://localhost:${server.port}/.well-known/jwks.json`,
    hits: () => hits,
    stop: () => server.stop(),
  };
}

describe("JWKS endpoint unavailable", () => {
  /** Returns a tenant with the internal test issuer that uses the given JWKS endpoint. */
  function deadTenant(jwksUri: string): AuthTenant {
    return {
      name: "internal",
      issuer: INTERNAL_ISSUER,
      audience: INTERNAL_AUDIENCE,
      jwksUri,
      userInfoUri: "http://localhost:0/unused/userinfo",
    };
  }

  test("strict endpoint returns 503, not 401, when JWKS cannot be fetched", async () => {
    const server = jwksServer(() => new Response("boom", { status: 500 }));
    try {
      const app = new Hono();
      app.use("/protected", createValidateJwt([deadTenant(server.url)]));
      app.get("/protected", (c) => c.json({ ok: true }));
      const token = await signInternalToken();
      const res = await app.request("/protected", { headers: bearer(token) });
      expect(res.status).toBe(503);
    } finally {
      server.stop();
    }
  });

  test("optionalAuth proceeds anonymously when JWKS cannot be fetched", async () => {
    const server = jwksServer(() => new Response("boom", { status: 500 }));
    try {
      const app = new Hono();
      app.use("/public", createOptionalAuth(createValidateJwt([deadTenant(server.url)])));
      app.get("/public", (c) => c.json({ sub: c.get("jwtPayload")?.sub ?? null }));
      const token = await signInternalToken();
      const res = await app.request("/public", { headers: bearer(token) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ sub: null });
    } finally {
      server.stop();
    }
  });
});
