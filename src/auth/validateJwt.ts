import { jwk } from "hono/jwk";
import { config } from "../config";

/**
 * Validates an Auth0-issued access token sent as `Authorization: Bearer <token>`.
 *
 * Fetches Auth0's public signing keys from the JWKS endpoint and verifies the
 * token signature, issuer, audience and expiry. On success, decoded claims are
 * available via `c.get("jwtPayload")`; on failure it throws an HTTPException 401.
 */
export const validateJwt = jwk({
  jwks_uri: config.jwksUri,
  alg: ["RS256"],
  verification: {
    iss: config.issuer,
    aud: config.auth0Audience,
  },
});
