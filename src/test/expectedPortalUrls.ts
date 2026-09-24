import type { Environment } from "../config";

/**
 * The exact app links for each environment, in the order the panel shows them.
 * The panel sorts by app name, so Partner (host `entur-partner`) comes after
 * Ops center, not first.
 *
 * The URLs are written out by hand because the hosts do not follow one pattern.
 * For example, CLEOS uses a different subdomain and top-level domain outside
 * production.
 *
 * This is its own file so several test files can use it. Importing a test file
 * would run its tests twice.
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

/** Returns the expected links for an environment. Local uses the dev links. */
export const expectedUrls = (environment: Environment): string[] =>
  EXPECTED_URLS[environment === "local" ? "dev" : environment];
