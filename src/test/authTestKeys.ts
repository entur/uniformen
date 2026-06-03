export const ISSUER = "https://test.local/";
export const AUDIENCE = "https://api.uniformen.test";
export const KID = "test-key-1";

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);

const publicJwk = await crypto.subtle.exportKey("jwk", publicKey);

/**
 * `jwks` is the public JWKS the test server (see `authTestSetup`) serves.
 */
export const jwks = { keys: [{ ...publicJwk, kid: KID, alg: "RS256", use: "sig" }] };

/**
 * `signToken` mints valid RS256 access tokens; pass overrides to forge bad ones.
 */
export async function signToken(claims: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: KID };
  const payload = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: "test|client",
    iat: now,
    exp: now + 3600,
    ...claims,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(signature)}`;
}
