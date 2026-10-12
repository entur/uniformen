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

/**
 * A mock of the notification center endpoint. It works the same way as
 * `userInfoMock`.
 */
export const notificationMock = {
  calls: 0,
  respond: (_req: Request): Response | Promise<Response> => Response.json([]),
  reset(): void {
    this.calls = 0;
    this.respond = (_req) => Response.json([]);
  },
};

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
    if (pathname === "/notification-center/messages") {
      notificationMock.calls++;
      return notificationMock.respond(req);
    }
    return new Response("not found", { status: 404 });
  },
});

afterAll(() => server.stop());
// Bun loads .env before this file runs. Remove the PostHog key so no test calls PostHog.
delete process.env["POSTHOG_API_KEY"];
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
process.env["NOTIFICATION_API_URI"] =
  `http://localhost:${server.port}/notification-center/messages`;
