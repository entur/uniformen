import type { Environment } from "../config";

/** One resolved link, as the app switcher panel renders it. */
export type PortalApplication = { id: PortalApplicationId; appName: string; url: string };

/** Host per environment. */
type Hosts = Record<"dev" | "staging" | "production", string>;

/**
 * The environments an application can be switched to from another environment.
 * `local` is absent on purpose: a localhost URL means nothing to anyone but the
 * developer running it, so a local instance offers the three deployed ones.
 */
export type SwitchableEnvironment = keyof Hosts;

/** Declaration order, and the order the environment switcher lists them in. */
export const SWITCHABLE_ENVIRONMENTS: readonly SwitchableEnvironment[] = [
  "dev",
  "staging",
  "production",
];

/**
 * Every B2B application the portal knows about. An entry's `id` is the value apps
 * send as the `app` query param, and `appName` names it in both the switcher and
 * the logo slot.
 *
 * Declared in the order the switcher lists them: alphabetical by name in
 * Norwegian collation, where Ø sorts last.
 */
const APPLICATIONS = [
  {
    id: "cleos",
    appName: "CLEOS",
    hosts: {
      dev: "cleos-client.dev.entur.io",
      staging: "cleos-client.staging.entur.io",
      production: "cleos.entur.org",
    },
  },
  {
    id: "nplan",
    appName: "Nplan",
    hosts: {
      dev: "nplan.dev.entur.org",
      staging: "nplan.staging.entur.org",
      production: "nplan.entur.org",
    },
  },
  {
    id: "ops-center",
    appName: "Ops Center",
    hosts: {
      dev: "ops-center.dev.entur.io",
      staging: "ops-center.staging.entur.io",
      production: "ops-center.entur.io",
    },
  },
  {
    id: "partner",
    appName: "Partner",
    hosts: {
      dev: "entur-partner.dev.entur.org",
      staging: "entur-partner.staging.entur.org",
      production: "entur-partner.entur.org",
    },
  },
  {
    id: "sorvis",
    appName: "Sørvis",
    hosts: {
      dev: "sorvis.dev.entur.io",
      staging: "sorvis.staging.entur.io",
      production: "sorvis.entur.io",
    },
  },
] as const satisfies readonly { id: string; appName: string; hosts: Hosts }[];

export const PORTAL_APPLICATION_IDS = APPLICATIONS.map(({ id }) => id);

export type PortalApplicationId = (typeof APPLICATIONS)[number]["id"];

/**
 * One application's hosts as the URLs the header links to, keyed by environment.
 * The single place a host becomes a URL, so both tables below — every app in one
 * environment, and one app in every environment — read the same scheme and the
 * same set of environments.
 */
const urlsFor = (hosts: Hosts): Readonly<Record<SwitchableEnvironment, string>> =>
  Object.fromEntries(
    SWITCHABLE_ENVIRONMENTS.map((env) => [env, `https://${hosts[env]}`]),
  ) as Readonly<Record<SwitchableEnvironment, string>>;

/**
 * Every application with its hosts already turned into URLs, resolved once at
 * module load. Both tables below are views onto this one pass: the app switcher
 * needs every app in one environment, the environment switcher needs one app in
 * every environment.
 */
const APPLICATIONS_WITH_URLS = APPLICATIONS.map(({ id, appName, hosts }) => ({
  id,
  appName,
  urls: urlsFor(hosts),
}));

const resolve = (key: SwitchableEnvironment): PortalApplication[] =>
  APPLICATIONS_WITH_URLS.map(({ id, appName, urls }) => ({ id, appName, url: urls[key] }));

/**
 * The link list per environment, resolved once at module load so rendering a
 * header costs no work beyond the markup.
 */
export const PORTAL_APPLICATIONS: Record<Environment, PortalApplication[]> = {
  local: resolve("dev"),
  dev: resolve("dev"),
  staging: resolve("staging"),
  production: resolve("production"),
};

/** One application's own URL in every switchable environment, keyed by id. */
const APPLICATION_URLS = new Map<string, Readonly<Record<SwitchableEnvironment, string>>>(
  APPLICATIONS_WITH_URLS.map(({ id, urls }) => [id, urls]),
);

/**
 * Where the same application lives in each switchable environment. Undefined for
 * an unknown or absent id — an app the portal does not know about cannot be
 * followed across environments, and the environment badge stays static.
 *
 * The record is the shared instance from the table, so it is handed out readonly:
 * mutating it would change what every later render links to.
 */
export function portalApplicationUrls(
  id?: string,
): Readonly<Record<SwitchableEnvironment, string>> | undefined {
  return id === undefined ? undefined : APPLICATION_URLS.get(id);
}

const APP_NAMES = new Map<string, string>(APPLICATIONS.map(({ id, appName }) => [id, appName]));

/** The name an application goes by beside the logo. */
export function portalApplicationName(id?: string): string | undefined {
  return id === undefined ? undefined : APP_NAMES.get(id);
}
