function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// The audience env var can be a comma-separated list. jose's jwtVerify accepts a
// token that matches any audience in an array. This lets one tenant accept tokens
// for several resources, for example both the portal audience and the api audience.
function requiredAudiences(name: string): string | string[] {
  const [first, ...rest] = requiredEnv(name)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!first) throw new Error(`Invalid env var: ${name} (expected at least one audience)`);
  return rest.length === 0 ? first : [first, ...rest];
}

// Auth0 only issues a machine token for an API that is registered in the tenant, so
// this must be one of the audiences we already accept, not a name we pick.
function firstAudience(name: string): string {
  const audiences = requiredAudiences(name);
  return Array.isArray(audiences) ? audiences[0]! : audiences;
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

export type MachineUser = {
  tokenUri: string;
  clientId: string;
  clientSecret: string;
  /** The API we ask Auth0 for a machine token for. */
  audience: string;
};

// Only deleting a notification needs the machine user. Both variables must exist, so a
// deployed environment without them fails at startup. Set both to an empty string to
// run without the machine user locally. Then clicking a notification deletes nothing.
// When only one of them is empty, requiredEnv throws.
function machineUser(): MachineUser | undefined {
  const clientId = process.env["MNG_AUTH0_INT_CLIENT_ID"];
  const clientSecret = process.env["MNG_AUTH0_INT_CLIENT_SECRET"];
  if (clientId === undefined || clientSecret === undefined) {
    throw new Error(
      "Missing required env var: MNG_AUTH0_INT_CLIENT_ID or MNG_AUTH0_INT_CLIENT_SECRET (set both to an empty string to run without them)",
    );
  }
  if (!clientId && !clientSecret) {
    console.warn(
      "MNG_AUTH0_INT_CLIENT_ID and MNG_AUTH0_INT_CLIENT_SECRET are not set, so clicking a notification does not delete it",
    );
    return undefined;
  }
  return {
    tokenUri: requiredEnv("AUTH0_INTERNAL_TOKEN_URI"),
    clientId: requiredEnv("MNG_AUTH0_INT_CLIENT_ID"),
    clientSecret: requiredEnv("MNG_AUTH0_INT_CLIENT_SECRET"),
    audience: firstAudience("AUTH0_INTERNAL_AUDIENCE"),
  };
}

export const config = {
  /** Auth0 tenants whose access tokens we accept. */
  tenants: [internalTenant, partnerTenant],
  /** Uniformen's own machine user, or `undefined` when it is not configured. */
  machineUser: machineUser(),
  /** The notification center, without a path. It serves both tenants. */
  notificationApiBaseUri: requiredEnv("NOTIFICATION_API_BASE_URI"),
};
