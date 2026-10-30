import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { HonoRequest } from "hono/request";
import { environment, type Environment } from "../config";

// The leading dot stops a host like `evilentur.org` from matching.
const ALLOWED_DOMAINS = [".entur.org", ".entur.io", ".entur.no"];

export const ENVIRONMENT_HOSTNAMES: Record<Environment, string> = {
  local: "http://localhost:4123",
  dev: "https://uniformen.dev.entur.no",
  staging: "https://uniformen.staging.entur.no",
  production: "https://uniformen.entur.no",
} as const;

/** Where a browser reaches uniformen in this environment. Goes in `connect-src`. */
export const uniformenOrigin = ENVIRONMENT_HOSTNAMES[environment];

export function getEnvironmentUrl(path: string) {
  return new URL(path, ENVIRONMENT_HOSTNAMES[environment]).href;
}

interface CreateBrowserToken {
  sub: string;
  audience: string;
  lifetime: string;
  payload?: { [claim: string]: string };
  key: Uint8Array;
}
export async function createBrowserToken(args: CreateBrowserToken): Promise<string> {
  return await new SignJWT(args.payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.sub)
    .setAudience(args.audience)
    .setExpirationTime(args.lifetime)
    .sign(args.key);
}

interface VerifyBrowserTokenArgs {
  key: Uint8Array;
  audience: string;
  requiredPayloadProperties?: string[];
}

/**
 * Checks that a token we made ourselves is valid, and returns what is inside it.
 * Throws when the signature, the audience, the expiry or a required claim is wrong.
 *
 * Pass the shape of the extra claims as `T` to get them typed in the return value,
 * and list the same names in `requiredPayloadProperties` so a token without them is
 * rejected instead of returning `undefined` at runtime.
 */
export async function verifyBrowserToken<T extends Record<string, string> = Record<string, never>>(
  token: string,
  verifyArgs: VerifyBrowserTokenArgs,
) {
  const { payload } = await jwtVerify<JWTPayload & T & { sub: string }>(token, verifyArgs.key, {
    algorithms: ["HS256"],
    audience: verifyArgs.audience,
    requiredClaims: ["sub", ...(verifyArgs.requiredPayloadProperties ?? [])],
  });

  return payload;
}

export function getBearerTokenFromRequest(req: HonoRequest) {
  return /^Bearer (\S+)$/i.exec(req.header("Authorization") ?? "")?.[1];
}

/**
 * Returns `origin` if a browser on that origin may call uniformen's browser routes,
 * or `undefined` if not. Allows https on subdomains of entur.org, entur.io and
 * entur.no. In local and dev, it also allows http and https on localhost and
 * 127.0.0.1, so an app on a developer's machine can use them in dev. This is safe
 * because every request must have a valid token, and CORS does not allow cookies.
 */
export function allowedOrigin(origin: string): string | undefined {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  if (
    (environment === "local" || environment === "dev") &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return origin;
  }

  const isAllowedDomain = ALLOWED_DOMAINS.some((suffix) => url.hostname.endsWith(suffix));
  return url.protocol === "https:" && isAllowedDomain ? origin : undefined;
}
