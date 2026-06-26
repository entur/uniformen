function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Audiences may be a comma-separated list. jose's jwtVerify treats an array as
// "match any", so one tenant can accept tokens minted for several resources
// (e.g. partner web-app users carry the portal audience, while other
// partner-tenant apps carry the api audience). Same issuer, multiple audiences.
function requiredAudiences(name: string): string | string[] {
  const [first, ...rest] = requiredEnv(name)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!first) throw new Error(`Invalid env var: ${name} (expected at least one audience)`);
  return rest.length === 0 ? first : [first, ...rest];
}

export type Environment = "local" | "dev" | "staging" | "production";

const parseEnvironment = (value: string): Environment => {
  switch (value) {
    case "local":
    case "dev":
    case "staging":
    case "production":
      return value;
    default:
      throw new Error(
        `Invalid ENVIRONMENT: ${value} (expected local, dev, staging, or production)`,
      );
  }
};

export const environment: Environment = parseEnvironment(requiredEnv("ENVIRONMENT"));

export type AuthTenant = {
  name: "internal" | "partner";
  issuer: string;
  audience: string | string[];
  jwksUri: string;
  userInfoUri: string;
};

const internalTenant: AuthTenant = {
  name: "internal",
  audience: requiredAudiences("AUTH0_INTERNAL_AUDIENCE"),
  issuer: requiredEnv("AUTH0_INTERNAL_ISSUER"),
  jwksUri: requiredEnv("AUTH0_INTERNAL_JWKS_URI"),
  userInfoUri: requiredEnv("AUTH0_INTERNAL_USERINFO_URI"),
};

const partnerTenant: AuthTenant = {
  name: "partner",
  audience: requiredAudiences("AUTH0_PARTNER_AUDIENCE"),
  issuer: requiredEnv("AUTH0_PARTNER_ISSUER"),
  jwksUri: requiredEnv("AUTH0_PARTNER_JWKS_URI"),
  userInfoUri: requiredEnv("AUTH0_PARTNER_USERINFO_URI"),
};

export const config = {
  /** Auth0 tenants whose access tokens we accept. */
  tenants: [internalTenant, partnerTenant],
};
