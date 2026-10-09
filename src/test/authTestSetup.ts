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
 * A mock of the Auth0 userinfo endpoints. Tests can replace `respond` to simulate
 * errors or slow answers, and read `calls` to check how many requests were made.
 * Call `reset()` in `beforeEach`.
 */
export const userInfoMock = {
  calls: 0,
  respond: (_req: Request): Response | Promise<Response> =>
    Response.json({ sub: "auth0|test", name: "Hallstein Bronskimlet" }),
  reset(): void {
    this.calls = 0;
    this.respond = (_req) => Response.json({ sub: "auth0|test", name: "Hallstein Bronskimlet" });
  },
};

const machineTokenResponse = () =>
  Response.json({ access_token: "machine-token", expires_in: 3600, token_type: "Bearer" });

/**
 * A mock of the internal Auth0 token endpoint, which gives uniformen a machine
 * token for sporai. Works like `userInfoMock`.
 */
export const machineTokenMock = {
  calls: 0,
  respond: (_req: Request): Response | Promise<Response> => machineTokenResponse(),
  reset(): void {
    this.calls = 0;
    this.respond = (_req) => machineTokenResponse();
  },
};

/**
 * A mock of the sporai chat call (`POST /api/chat`). It counts only chat calls, not
 * session calls. Works like `userInfoMock`.
 */
export const sporaiMock = {
  calls: 0,
  respond: (_req: Request): Response | Promise<Response> => new Response("svar"),
  reset(): void {
    this.calls = 0;
    this.respond = (_req) => new Response("svar");
  },
};

/** The session id the fake sporai returns. Sporai uses UUIDs. */
export const SPORAI_SESSION_ID = "0b6f1f5e-3c2a-4d8e-9a71-5f2c8e4b1d07";

/**
 * Starts a local server with the test JWKS and userinfo endpoints for each tenant,
 * and sets the Auth0 env vars to point at it. bunfig.toml preloads this file, so
 * it runs before any test module, and before `config.ts` reads the env vars.
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
    // The machine token endpoint and the fake sporai. Sporai has no auth check here.
    if (pathname === "/internal/oauth/token") {
      machineTokenMock.calls++;
      return machineTokenMock.respond(req);
    }
    if (pathname === "/sporai/api/chat/sessions" && req.method === "POST") {
      return Response.json({ sessionId: SPORAI_SESSION_ID });
    }
    if (pathname === "/sporai/api/chat" && req.method === "POST") {
      sporaiMock.calls++;
      return sporaiMock.respond(req);
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
// Chat settings. They point at the machine token endpoint and the fake sporai above.
process.env["AUTH0_INTERNAL_TOKEN_URI"] = `http://localhost:${server.port}/internal/oauth/token`;
process.env["SPORAI_URL"] = `http://localhost:${server.port}/sporai`;
process.env["MNG_AUTH0_INT_CLIENT_ID"] = "test-client";
process.env["MNG_AUTH0_INT_CLIENT_SECRET"] = "test-secret";
process.env["AUTH0_PARTNER_AUDIENCE"] = PARTNER_AUDIENCE;
process.env["AUTH0_PARTNER_ISSUER"] = PARTNER_ISSUER;
process.env["AUTH0_PARTNER_JWKS_URI"] =
  `http://localhost:${server.port}/partner/.well-known/jwks.json`;
process.env["AUTH0_PARTNER_USERINFO_URI"] = `http://localhost:${server.port}/partner/userinfo`;
