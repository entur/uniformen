import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";
import { config, type AuthTenant } from "../config";

declare module "hono" {
  interface ContextVariableMap {
    authTenant: AuthTenant["name"] | undefined;
    jwtPayload: (JWTPayload & { name?: string }) | undefined;
    /** The verified bearer token. It is sent on to Auth0's userinfo endpoint. */
    authToken: string | undefined;
  }
}

/**
 * Thrown when the tenant's JWKS endpoint cannot be fetched. Without the keys we
 * cannot tell whether the token is valid or not.
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
  // Create one validator per tenant, so a token is always checked against the
  // issuer, audiences and JWKS endpoint of the same tenant.
  const validators = new Map(
    tenants.map((tenant) => {
      // jose caches the keys for 10 minutes and shares one request between
      // parallel fetches, with a 5-second timeout. If a token has an unknown `kid`,
      // jose fetches the keys again (at most every 30 seconds), so a new signing
      // key is found quickly.
      const jwks = createRemoteJWKSet(new URL(tenant.jwksUri));
      // Tell apart "the keys could not be fetched" (503) and "no key matches the
      // token" (401). Only `JWKSNoMatchingKey` means the token itself is bad.
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
    // Require the Bearer scheme. RFC 9110 says the scheme name is case-insensitive.
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
      unauthorized(c, "invalid_request", "invalid credentials structure");
    }
    const token = parts[1];

    // Read the unverified `iss` claim to pick the tenant. `jwtVerify` below checks
    // it again against the tenant's configured issuer.
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
      // The response does not say why the token failed, so log the reason
      // (for example expired, bad signature or wrong audience) for debugging.
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
 * Validates an Auth0 access token sent as `Authorization: Bearer <token>`.
 *
 * The unverified `iss` claim picks the tenant. The token's signature, issuer,
 * audience and expiry are then checked with that tenant's keys. Tokens from
 * unknown issuers are rejected. On success, the claims are available with
 * `c.get("jwtPayload")`, the tenant name with `c.get("authTenant")` and the token
 * with `c.get("authToken")`. On failure it throws an HTTPException: 401 for a bad
 * token, or 503 (`JwksUnavailableError`) when the tenant's keys could not be fetched.
 */
export const validateJwt = createValidateJwt(config.tenants);
