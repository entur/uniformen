import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { JwksUnavailableError, validateJwt } from "./validateJwt";

/**
 * Wraps `validate` so authentication becomes best-effort: a 401 from it
 * (missing/invalid token) or a `JwksUnavailableError` (keys unreachable)
 * lets the request proceed anonymously instead of being rejected; anything
 * `validate` set on the context before succeeding is kept, and any other
 * error is rethrown.
 */
export function createOptionalAuth(validate: MiddlewareHandler) {
  return createMiddleware(async (c, next) => {
    try {
      // On success this sets `jwtPayload` and calls `next()` for us.
      return await validate(c, next);
    } catch (error) {
      if (error instanceof HTTPException && error.status === 401) {
        // No / invalid token — continue anonymously.
        return next();
      }
      if (error instanceof JwksUnavailableError) {
        // JWKS outage: the token can't be verified either way, and a public
        // endpoint shouldn't fail because of it — continue anonymously.
        return next();
      }
      throw error;
    }
  });
}

/**
 * Best-effort authentication for public endpoints.
 *
 * If a valid `Authorization: Bearer <token>` is present, decoded claims are
 * exposed via `c.get("jwtPayload")`. If the token is missing, expired, or
 * otherwise invalid, the request proceeds anonymously (no payload) rather than being rejected.
 * This is intentional. The endpoint is public and only uses the token to enrich context.
 */
export const optionalAuth = createOptionalAuth(validateJwt);
