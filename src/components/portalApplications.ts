import type { Environment } from "../config";

/** One resolved link, as the app switcher panel renders it. */
export type PortalApplication = { id: PortalApplicationId; appName: string; url: string };

/**
 * The environments an application can be switched to from another environment.
 * `local` is absent on purpose: a localhost URL means nothing to anyone but the
 * developer running it, so a local instance offers the three deployed ones.
 */
export type SwitchableEnvironment = "dev" | "staging" | "production";

/** Declaration order, and the order the environment switcher lists them in. */
export const SWITCHABLE_ENVIRONMENTS: readonly SwitchableEnvironment[] = [
  "dev",
  "staging",
  "production",
];

/** Host per environment. An environment left out is not deployed. */
type Hosts = Partial<Record<SwitchableEnvironment, string>>;

/**
 * Every B2B application the portal knows about. An entry's `id` is the value apps
 * send as the `app` query param, and `appName` names it in both the switcher and
 * the logo slot. `unlisted` keeps an entry out of the switcher.
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
    id: "skoleskyss",
    appName: "Skoleskyss",
    unlisted: true,
    hosts: {
      staging: "skoleskyss.staging.entur.no",
      production: "skoleskyss.entur.no",
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
] as const satisfies readonly { id: string; appName: string; hosts: Hosts; unlisted?: true }[];

/** Every id the `app` param accepts, unlisted ones included. */
export const PORTAL_APPLICATION_IDS = APPLICATIONS.map(({ id }) => id);

export type PortalApplicationId = (typeof APPLICATIONS)[number]["id"];

/** One application's URLs, keyed by the environments it is deployed to. */
export type ApplicationUrls = Readonly<Partial<Record<SwitchableEnvironment, string>>>;

/**
 * One application's hosts as the URLs the header links to, keyed by environment.
 * The single place a host becomes a URL, so both tables below — every app in one
 * environment, and one app in every environment — read the same scheme and the
 * same set of environments.
 */
const urlsFor = (hosts: Hosts): ApplicationUrls =>
  Object.fromEntries(
    SWITCHABLE_ENVIRONMENTS.filter((env) => hosts[env] !== undefined).map((env) => [
      env,
      `https://${hosts[env]}`,
    ]),
  );

/**
 * Every application with its hosts already turned into URLs, resolved once at
 * module load. Both tables below are views onto this one pass: the app switcher
 * needs every app in one environment, the environment switcher needs one app in
 * every environment.
 */
const APPLICATIONS_WITH_URLS = APPLICATIONS.map((app) => ({
  id: app.id,
  appName: app.appName,
  urls: urlsFor(app.hosts),
  unlisted: "unlisted" in app,
}));

/** The switcher entries one environment has: listed, and deployed here. */
const resolve = (key: SwitchableEnvironment): PortalApplication[] =>
  APPLICATIONS_WITH_URLS.flatMap(({ id, appName, urls, unlisted }) => {
    const url = urls[key];
    return unlisted || url === undefined ? [] : [{ id, appName, url }];
  });

/**
 * Whose hosts an instance hands out. Every environment serves its own, except
 * `local`, which has none deployed and rides dev: nobody can be sent to localhost.
 * The single statement of that rule — everything resolving a link for a running
 * instance reads it from here.
 */
const LINKED_ENVIRONMENT: Record<Environment, SwitchableEnvironment> = {
  local: "dev",
  dev: "dev",
  staging: "staging",
  production: "production",
};

/**
 * The link list per environment, resolved once at module load so rendering a
 * header costs no work beyond the markup.
 */
export const PORTAL_APPLICATIONS: Record<Environment, PortalApplication[]> = {
  local: resolve(LINKED_ENVIRONMENT.local),
  dev: resolve(LINKED_ENVIRONMENT.dev),
  staging: resolve(LINKED_ENVIRONMENT.staging),
  production: resolve(LINKED_ENVIRONMENT.production),
};

/**
 * One application's own URL in each environment it is deployed to, keyed by id.
 * Keyed by the id union rather than by `string`, so looking an application up with
 * an id from the table is total: no absent case to handle, and dropping an
 * application from the table breaks every link into it at compile time instead of
 * resolving to `undefined` at runtime. Each entry keeps only the environments its
 * own hosts declare, so a link into an app deployed everywhere is a `string` and
 * one into a partly deployed app has to be checked.
 *
 * Reaching that from `Object.fromEntries`, whose keys are `string` however narrow
 * the input, is what the assertion is for.
 */
type ApplicationUrlTable = {
  readonly [A in (typeof APPLICATIONS)[number] as A["id"]]: {
    readonly [E in keyof A["hosts"]]: string;
  };
};

const APPLICATION_URLS = Object.fromEntries(
  APPLICATIONS_WITH_URLS.map(({ id, urls }) => [id, urls]),
) as ApplicationUrlTable;

const isPortalApplicationId = (id: string): id is PortalApplicationId =>
  Object.hasOwn(APPLICATION_URLS, id);

/**
 * Where the same application lives in each environment it is deployed to.
 * Undefined for an unknown or absent id, and for one with no host in the
 * environment given: switching is switching away from here, so an app this
 * instance does not run has nowhere to switch from.
 *
 * The record is the shared instance from the table, so it is handed out readonly:
 * mutating it would change what every later render links to.
 */
export function portalApplicationUrls(
  id: string | undefined,
  environment: Environment,
): ApplicationUrls | undefined {
  if (id === undefined || !isPortalApplicationId(id)) return undefined;
  const urls: ApplicationUrls = APPLICATION_URLS[id];
  return urls[LINKED_ENVIRONMENT[environment]] === undefined ? undefined : urls;
}

/** The applications with a host in every environment. */
type FullyDeployedApplicationId = Extract<
  (typeof APPLICATIONS)[number],
  { hosts: Required<Hosts> }
>["id"];

/**
 * One application's host in the environment given, as the base for a link to a
 * page inside it. `local` gets dev's, like every other link the header renders.
 *
 * Takes one of the applications deployed everywhere: a link written without a
 * check needs a host wherever this instance runs.
 */
export function portalApplicationUrl(
  id: FullyDeployedApplicationId,
  environment: Environment,
): string {
  return APPLICATION_URLS[id][LINKED_ENVIRONMENT[environment]];
}

const APP_NAMES = new Map<string, string>(APPLICATIONS.map(({ id, appName }) => [id, appName]));

/** The name an application goes by beside the logo. */
export function portalApplicationName(id?: string): string | undefined {
  return id === undefined ? undefined : APP_NAMES.get(id);
}
