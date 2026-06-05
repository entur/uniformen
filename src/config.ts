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
  userInfoUri: string;
};

const internalTenant: AuthTenant = {
  name: "internal",
  audience: requiredEnv("AUTH0_INTERNAL_AUDIENCE"),
  issuer: requiredEnv("AUTH0_INTERNAL_ISSUER"),
  jwksUri: requiredEnv("AUTH0_INTERNAL_JWKS_URI"),
  userInfoUri: requiredEnv("AUTH0_INTERNAL_USERINFO_URI"),
};

const partnerTenant: AuthTenant = {
  name: "partner",
  audience: requiredEnv("AUTH0_PARTNER_AUDIENCE"),
  issuer: requiredEnv("AUTH0_PARTNER_ISSUER"),
  jwksUri: requiredEnv("AUTH0_PARTNER_JWKS_URI"),
  userInfoUri: requiredEnv("AUTH0_PARTNER_USERINFO_URI"),
};

export const config = {
  /** Auth0 tenants whose access tokens we accept. */
  tenants: [internalTenant, partnerTenant],
};
