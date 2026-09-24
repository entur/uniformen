import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { JwksUnavailableError, validateJwt } from "./validateJwt";

/**
 * Wraps `validate` so that a failed login does not reject the request. If
 * `validate` throws a 401 (missing or invalid token) or a `JwksUnavailableError`
 * (signing keys could not be fetched), the request continues as anonymous. Any
 * other error is thrown again.
 */
export function createOptionalAuth(validate: MiddlewareHandler) {
  return createMiddleware(async (c, next) => {
    try {
      // On success, `validate` sets `jwtPayload` and calls `next()` itself.
      return await validate(c, next);
    } catch (error) {
      if (error instanceof HTTPException && error.status === 401) {
        // The token is missing or invalid, so continue as anonymous.
        return next();
      }
      if (error instanceof JwksUnavailableError) {
        // We cannot check the token without the signing keys. The endpoint is
        // public, so it should not fail because of this. Continue as anonymous.
        return next();
      }
      throw error;
    }
  });
}

/**
 * Reads the user from the token on public endpoints, if there is one.
 *
 * If the request has a valid `Authorization: Bearer <token>` header, the decoded
 * claims are available with `c.get("jwtPayload")`. If the token is missing, expired
 * or invalid, the request continues as anonymous with no payload. The endpoint is
 * public and only uses the token to show who is signed in.
 */
export const optionalAuth = createOptionalAuth(validateJwt);
