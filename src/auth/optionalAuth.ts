import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { validateJwt } from "./validateJwt";

type JwtPayload = { sub?: string; name?: string };

declare module "hono" {
  interface ContextVariableMap {
    jwtPayload: JwtPayload | undefined;
  }
}

/**
 * Best-effort authentication for public endpoints.
 *
 * If a valid `Authorization: Bearer <token>` is present, decoded claims are
 * exposed via `c.get("jwtPayload")`. If the token is missing, expired, or
 * otherwise invalid, the request proceeds anonymously (no payload) rather than
 * being rejected. This is intentional: the endpoint is public and only uses the
 * token to enrich context (e.g. show the logged-in user's name).
 */
export const optionalAuth = createMiddleware(async (c, next) => {
  try {
    // On success this sets `jwtPayload` and calls `next()` for us.
    return await validateJwt(c, next);
  } catch (error) {
    if (error instanceof HTTPException && error.status === 401) {
      // No / invalid token — continue anonymously.
      return next();
    }
    throw error;
  }
});
