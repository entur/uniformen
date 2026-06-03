function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const auth0Domain = required("AUTH0_DOMAIN");

export const config = {
  auth0Domain,
  auth0Audience: required("AUTH0_AUDIENCE"),
  // Derived from the domain, but overridable for Auth0 custom domains and tests.
  issuer: process.env["AUTH0_ISSUER"] ?? `https://${auth0Domain}/`,
  jwksUri: process.env["AUTH0_JWKS_URI"] ?? `https://${auth0Domain}/.well-known/jwks.json`,
};
