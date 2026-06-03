import { afterAll } from "bun:test";
import { AUDIENCE, ISSUER, jwks } from "./authTestKeys";

/**
 * Test-only auth harness. Loaded via `preload` in bunfig.toml so it runs
 * before any test module (and thus before `config.ts`) reads env:
 *  - serves the test JWKS from a local endpoint,
 *  - points the app's Auth0 config at that endpoint via env vars.
 */
const server = Bun.serve({
  port: 0,
  fetch(req) {
    if (new URL(req.url).pathname === "/.well-known/jwks.json") {
      return Response.json(jwks);
    }
    return new Response("not found", { status: 404 });
  },
});

afterAll(() => server.stop());
process.env["AUTH0_DOMAIN"] = "test.local";
process.env["AUTH0_AUDIENCE"] = AUDIENCE;
process.env["AUTH0_ISSUER"] = ISSUER;
process.env["AUTH0_JWKS_URI"] = `http://localhost:${server.port}/.well-known/jwks.json`;
