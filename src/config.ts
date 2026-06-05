function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export type AuthTenant = {
  name: "internal" | "partner";
  issuer: string;
  audience: string;
  jwksUri: string;
};

const auth0InternalDomain = requiredEnv("AUTH0_INTERNAL_DOMAIN");

const internalTenant: AuthTenant = {
  name: "internal",
  audience: requiredEnv("AUTH0_INTERNAL_AUDIENCE"),
  // Derived from the domain, but overridable for Auth0 custom domains and tests.
  issuer: process.env["AUTH0_INTERNAL_ISSUER"] ?? `https://${auth0InternalDomain}/`,
  jwksUri:
    process.env["AUTH0_INTERNAL_JWKS_URI"] ??
    `https://${auth0InternalDomain}/.well-known/jwks.json`,
};

const auth0PartnerDomain = requiredEnv("AUTH0_PARTNER_DOMAIN");

const partnerTenant: AuthTenant = {
  name: "partner",
  audience: requiredEnv("AUTH0_PARTNER_AUDIENCE"),
  issuer: process.env["AUTH0_PARTNER_ISSUER"] ?? `https://${auth0PartnerDomain}/`,
  jwksUri:
    process.env["AUTH0_PARTNER_JWKS_URI"] ?? `https://${auth0PartnerDomain}/.well-known/jwks.json`,
};

export const config = {
  /** Auth0 tenants whose access tokens we accept. */
  tenants: [internalTenant, partnerTenant],
};
