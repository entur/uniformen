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
 * A mock of the Auth0 endpoint that hands out machine tokens. `expiresIn` is in
 * seconds, the same as Auth0's `expires_in`.
 */
export const machineTokenMock = {
  calls: 0,
  respond: (_req: Request): Response | Promise<Response> =>
    Response.json({ access_token: "machine-token", expires_in: 3600 }),
  reset(): void {
    this.calls = 0;
    this.respond = (_req) => Response.json({ access_token: "machine-token", expires_in: 3600 });
  },
};

/**
 * A mock of deleting one notification. `ids` holds the ids of every delete the test
 * server was asked for, in order.
 */
export const notificationDeleteMock = {
  ids: [] as string[],
  respond: (_req: Request): Response | Promise<Response> => new Response(null, { status: 204 }),
  reset(): void {
    this.ids = [];
    this.respond = (_req) => new Response(null, { status: 204 });
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
    if (pathname === "/notification-center/v1/messages") {
      notificationMock.calls++;
      return notificationMock.respond(req);
    }
    if (pathname === "/oauth/token") {
      machineTokenMock.calls++;
      return machineTokenMock.respond(req);
    }
    const deletePath = /^\/notification-center\/v1\/messages\/(.+)$/.exec(pathname);
    if (deletePath && req.method === "DELETE") {
      notificationDeleteMock.ids.push(deletePath[1] as string);
      return notificationDeleteMock.respond(req);
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
process.env["NOTIFICATION_API_BASE_URI"] = `http://localhost:${server.port}/notification-center`;
// The machine user. These are set here, not read from `.env`, so the tests do not
// need real credentials and never reach the real Auth0.
process.env["AUTH0_INTERNAL_TOKEN_URI"] = `http://localhost:${server.port}/oauth/token`;
process.env["MNG_AUTH0_INT_CLIENT_ID"] = "test-client-id";
process.env["MNG_AUTH0_INT_CLIENT_SECRET"] = "test-client-secret";
