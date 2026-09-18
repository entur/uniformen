import type { Environment } from "../config";

/**
 * The exact links each environment hands out, in the order the panel lists them —
 * by name, so Partner sits under its host's `entur-partner`.
 *
 * Written out rather than derived: the hosts follow no single pattern (CLEOS is
 * served from a different subdomain and TLD outside production, and Partner's host
 * keeps the `entur-` prefix its name dropped), so a rule here would only restate a
 * coincidence.
 *
 * Lives outside the suites that assert against it so both can share it without
 * importing a test file, which would register its cases twice.
 */
const EXPECTED_URLS: Record<"dev" | "staging" | "production", string[]> = {
  dev: [
    "https://cleos-client.dev.entur.io",
    "https://nplan.dev.entur.org",
    "https://ops-center.dev.entur.io",
    "https://entur-partner.dev.entur.org",
    "https://sorvis.dev.entur.io",
  ],
  staging: [
    "https://cleos-client.staging.entur.io",
    "https://nplan.staging.entur.org",
    "https://ops-center.staging.entur.io",
    "https://entur-partner.staging.entur.org",
    "https://sorvis.staging.entur.io",
  ],
  production: [
    "https://cleos.entur.org",
    "https://nplan.entur.org",
    "https://ops-center.entur.io",
    "https://entur-partner.entur.org",
    "https://sorvis.entur.io",
  ],
};

/** The links an environment serves, dev standing in for local. */
export const expectedUrls = (environment: Environment): string[] =>
  EXPECTED_URLS[environment === "local" ? "dev" : environment];
