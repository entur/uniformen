export const INTERNAL_ISSUER = "https://internal.test.local/";
export const INTERNAL_AUDIENCE = "https://api.uniformen.test";
export const INTERNAL_KID = "internal-test-key-1";

export const PARTNER_ISSUER = "https://partner.test.local/";
export const PARTNER_AUDIENCE = "https://portal.uniformen.test";
export const PARTNER_KID = "partner-test-key-1";

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
}

const internalKeys = await generateKeyPair();
const partnerKeys = await generateKeyPair();

async function publicJwks(publicKey: CryptoKey, kid: string) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return { keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] };
}

/**
 * Public JWKS the test server (see `authTestSetup`) serves — one per tenant,
 * each containing only that tenant's key so cross-tenant signatures fail.
 */
export const internalJwks = await publicJwks(internalKeys.publicKey, INTERNAL_KID);
export const partnerJwks = await publicJwks(partnerKeys.publicKey, PARTNER_KID);

async function sign(
  privateKey: CryptoKey,
  kid: string,
  defaults: { iss: string; aud: string },
  claims: Record<string, unknown>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid };
  const payload = {
    ...defaults,
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

/**
 * `signInternalToken` mints valid RS256 access tokens for the internal tenant;
 * pass overrides to forge bad ones.
 */
export async function signInternalToken(claims: Record<string, unknown> = {}): Promise<string> {
  return sign(
    internalKeys.privateKey,
    INTERNAL_KID,
    { iss: INTERNAL_ISSUER, aud: INTERNAL_AUDIENCE },
    claims,
  );
}

/**
 * `signPartnerToken` mints valid RS256 access tokens signed with the partner
 * tenant's key; pass overrides to forge bad ones.
 */
export async function signPartnerToken(claims: Record<string, unknown> = {}): Promise<string> {
  return sign(
    partnerKeys.privateKey,
    PARTNER_KID,
    { iss: PARTNER_ISSUER, aud: PARTNER_AUDIENCE },
    claims,
  );
}
