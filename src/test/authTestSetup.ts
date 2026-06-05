import { afterAll } from "bun:test";
import {
  INTERNAL_AUDIENCE,
  INTERNAL_ISSUER,
  internalJwks,
  PARTNER_AUDIENCE,
  PARTNER_ISSUER,
  partnerJwks,
} from "./authTestKeys";

/**
 * Test-only auth harness. Loaded via `preload` in bunfig.toml so it runs
 * before any test module (and thus before `config.ts`) reads env:
 *  - serves the test JWKS (one endpoint per tenant) from a local server,
 *  - points the app's Auth0 config at those endpoints via env vars.
 */
const server = Bun.serve({
  port: 0,
  fetch(req) {
    const pathname = new URL(req.url).pathname;
    if (pathname === "/internal/.well-known/jwks.json") {
      return Response.json(internalJwks);
    }
    if (pathname === "/partner/.well-known/jwks.json") {
      return Response.json(partnerJwks);
    }
    return new Response("not found", { status: 404 });
  },
});

afterAll(() => server.stop());
process.env["AUTH0_INTERNAL_DOMAIN"] = "internal.test.local";
process.env["AUTH0_INTERNAL_AUDIENCE"] = INTERNAL_AUDIENCE;
process.env["AUTH0_INTERNAL_ISSUER"] = INTERNAL_ISSUER;
process.env["AUTH0_INTERNAL_JWKS_URI"] =
  `http://localhost:${server.port}/internal/.well-known/jwks.json`;
process.env["AUTH0_PARTNER_DOMAIN"] = "partner.test.local";
process.env["AUTH0_PARTNER_AUDIENCE"] = PARTNER_AUDIENCE;
process.env["AUTH0_PARTNER_ISSUER"] = PARTNER_ISSUER;
process.env["AUTH0_PARTNER_JWKS_URI"] =
  `http://localhost:${server.port}/partner/.well-known/jwks.json`;
