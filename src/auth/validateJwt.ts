import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";
import { config, type AuthTenant } from "../config";

declare module "hono" {
  interface ContextVariableMap {
    authTenant: AuthTenant["name"] | undefined;
    jwtPayload: (JWTPayload & { name?: string }) | undefined;
    /** Raw verified bearer token, for forwarding to Auth0's userinfo endpoint. */
    authToken: string | undefined;
  }
}

/**
 * The tenant's JWKS endpoint could not be fetched, so the token can be
 * neither verified nor rejected.
 */
export class JwksUnavailableError extends HTTPException {
  constructor(message: string, options?: { cause?: unknown }) {
    super(503, { message, ...options });
  }
}

function unauthorized(_ctx: { req: { url: string } }, error: string, description: string): never {
  throw new HTTPException(401, {
    message: description,
    res: new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer error="${error}",error_description="${description}"`,
      },
    }),
  });
}

/**
 * Builds the validation middleware for a set of tenants.
 */
export function createValidateJwt(tenants: AuthTenant[]) {
  // One validator per tenant so issuer, audiences and JWKS endpoint are strictly paired
  const validators = new Map(
    tenants.map((tenant) => {
      // jose caches the JWKS for 10 minutes, dedupes concurrent fetches,
      // times out after 5 seconds, and refetches on an unknown `kid` (with a
      // 30-second cooldown) so a rotated signing key is picked up promptly.
      const jwks = createRemoteJWKSet(new URL(tenant.jwksUri));
      // Distinguish "keys could not be fetched" (503) from "token matches no key" (401)
      // only `JWKSNoMatchingKey` indicates the token itself.
      const getKey: JWTVerifyGetKey = async (header, token) => {
        try {
          return await jwks(header, token);
        } catch (cause) {
          if (cause instanceof errors.JWKSNoMatchingKey) throw cause;
          throw new JwksUnavailableError(`failed to fetch JWKS from ${tenant.jwksUri}`, { cause });
        }
      };
      return [tenant.issuer, { tenant, getKey }] as const;
    }),
  );

  if (validators.size !== tenants.length) {
    throw new Error(`duplicate tenant issuer detected: ${tenants.map((t) => t.issuer).join(", ")}`);
  }

  return createMiddleware(async (c, next) => {
    const credentials = c.req.header("Authorization");
    if (!credentials) {
      unauthorized(c, "invalid_request", "no authorization included in request");
    }
    const parts = credentials.split(/\s+/);
    // Enforce the Bearer scheme (case-insensitive per RFC 9110).
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
      unauthorized(c, "invalid_request", "invalid credentials structure");
    }
    const token = parts[1];

    // Peek at the (unverified) `iss` claim to pick the tenant; verification
    // below checks it again against the tenant's configured issuer.
    let issuer: unknown;
    try {
      issuer = decodeJwt(token).iss;
    } catch {
      unauthorized(c, "invalid_token", "token decoding failure");
    }
    const validator = typeof issuer === "string" ? validators.get(issuer) : undefined;
    if (!validator) {
      unauthorized(c, "invalid_token", "unknown token issuer");
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, validator.getKey, {
        issuer: validator.tenant.issuer,
        audience: validator.tenant.audience,
        algorithms: ["RS256"],
        requiredClaims: ["iss", "aud", "sub", "exp"],
      }));
    } catch (error) {
      if (error instanceof JwksUnavailableError) throw error;
      // The response stays generic, so log the real reason for debugging
      // (expired, bad signature, wrong audience)
      console.warn(
        `JWT verification failed for tenant "${validator.tenant.name}":`,
        error instanceof errors.JOSEError ? `${error.code} ${error.message}` : error,
      );
      unauthorized(c, "invalid_token", "token verification failure");
    }

    c.set("jwtPayload", payload);
    c.set("authTenant", validator.tenant.name);
    c.set("authToken", token);
    await next();
  });
}

/**
 * Validates an Auth0-issued access token sent as `Authorization: Bearer <token>`.
 *
 * The token's (unverified) `iss` claim selects the matching tenant, whose JWKS
 * endpoint then verifies the token signature, issuer, audience and expiry.
 * Tokens from unknown issuers are rejected. On success, decoded claims are
 * available via `c.get("jwtPayload")` and the tenant name via
 * `c.get("authTenant")`; on failure it throws an HTTPException — 401 for a
 * bad token, 503 (`JwksUnavailableError`) when the tenant's keys could not
 * be fetched at all.
 */
export const validateJwt = createValidateJwt(config.tenants);
