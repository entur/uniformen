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
 * Controllable mock for the Auth0 userinfo endpoints. Tests can swap
 * `respond` to simulate failures/delays and read `calls` to assert how many
 * requests reached upstream; call `reset()` in `beforeEach`.
 */
export const userInfoMock = {
  calls: 0,
  respond: (_req: Request): Response | Promise<Response> =>
    Response.json({ name: "Hallstein Bronskimlet" }),
  reset(): void {
    this.calls = 0;
    this.respond = (_req) => Response.json({ name: "Hallstein Bronskimlet" });
  },
};

/**
 * Test-only auth harness. Loaded via `preload` in bunfig.toml so it runs
 * before any test module (and thus before `config.ts`) reads env:
 *  - serves the test JWKS and userinfo (one endpoint per tenant) from a
 *    local server,
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
    if (pathname === "/internal/userinfo" || pathname === "/partner/userinfo") {
      userInfoMock.calls++;
      return userInfoMock.respond(req);
    }
    return new Response("not found", { status: 404 });
  },
});

afterAll(() => server.stop());
process.env["ENVIRONMENT"] = "dev";
process.env["AUTH0_INTERNAL_AUDIENCE"] = INTERNAL_AUDIENCE;
process.env["AUTH0_INTERNAL_ISSUER"] = INTERNAL_ISSUER;
process.env["AUTH0_INTERNAL_JWKS_URI"] =
  `http://localhost:${server.port}/internal/.well-known/jwks.json`;
process.env["AUTH0_INTERNAL_USERINFO_URI"] = `http://localhost:${server.port}/internal/userinfo`;
process.env["AUTH0_PARTNER_AUDIENCE"] = PARTNER_AUDIENCE;
process.env["AUTH0_PARTNER_ISSUER"] = PARTNER_ISSUER;
process.env["AUTH0_PARTNER_JWKS_URI"] =
  `http://localhost:${server.port}/partner/.well-known/jwks.json`;
process.env["AUTH0_PARTNER_USERINFO_URI"] = `http://localhost:${server.port}/partner/userinfo`;
