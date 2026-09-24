import type { Environment } from "../config";

/** One application link in the app switcher. */
export type PortalApplication = { id: PortalApplicationId; appName: string; url: string };

/**
 * The environments the header can link to. `local` is not included, because a
 * localhost URL only works for the developer who runs it.
 */
export type SwitchableEnvironment = "dev" | "staging" | "production";

/** The environments in the order the environment switcher lists them. */
export const SWITCHABLE_ENVIRONMENTS: readonly SwitchableEnvironment[] = [
  "dev",
  "staging",
  "production",
];

/** The host for each environment. A missing environment means the app is not deployed there. */
type Hosts = Partial<Record<SwitchableEnvironment, string>>;

/**
 * All B2B applications in the portal. `id` is the value apps send in the `app`
 * query param. `appName` is shown in the app switcher and next to the logo.
 * `unlisted` hides the application from the app switcher. `path` is set for an
 * application that is served below the root of its host. It is the same in every
 * environment.
 *
 * The app switcher uses the order of this list. Keep it sorted by name in
 * Norwegian alphabetical order, where Ø comes after Z.
 */
const APPLICATIONS = [
  {
    id: "bedrift",
    appName: "Bedrift",
    unlisted: true,
    path: "/bedrift",
    hosts: {
      staging: "skoleskyss.staging.entur.no",
      production: "skoleskyss.entur.no",
    },
  },
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
] as const satisfies readonly {
  id: string;
  appName: string;
  hosts: Hosts;
  path?: `/${string}`;
  unlisted?: true;
}[];

/** All ids the `app` param accepts, including unlisted ones. */
export const PORTAL_APPLICATION_IDS = APPLICATIONS.map(({ id }) => id);

export type PortalApplicationId = (typeof APPLICATIONS)[number]["id"];

// Adds `path` as an optional field to the entries that do not set it, so the code
// below can read `app.path` without checking first.
type ApplicationEntry = (typeof APPLICATIONS)[number] & { path?: `/${string}` };

/** One application's URL in each environment it is deployed to. */
export type ApplicationUrls = Readonly<Partial<Record<SwitchableEnvironment, string>>>;

/**
 * Turns an application's hosts into `https://` URLs, keyed by environment. This is
 * the only place a host becomes a URL, so all links use the same scheme.
 */
const urlsFor = (hosts: Hosts, path: string): ApplicationUrls =>
  Object.fromEntries(
    SWITCHABLE_ENVIRONMENTS.filter((env) => hosts[env] !== undefined).map((env) => [
      env,
      `https://${hosts[env]}${path}`,
    ]),
  );

/**
 * All applications with their URLs, computed once when the module loads. Both
 * tables below are built from this list.
 */
const APPLICATIONS_WITH_URLS = APPLICATIONS.map((app: ApplicationEntry) => ({
  id: app.id,
  appName: app.appName,
  path: app.path ?? "/",
  urls: urlsFor(app.hosts, app.path ?? ""),
  unlisted: "unlisted" in app,
}));

/** Returns the listed applications that are deployed in one environment. */
const resolve = (key: SwitchableEnvironment): PortalApplication[] =>
  APPLICATIONS_WITH_URLS.flatMap(({ id, appName, urls, unlisted }) => {
    const url = urls[key];
    return unlisted || url === undefined ? [] : [{ id, appName, url }];
  });

/**
 * Maps each environment to the environment whose hosts it links to. Each
 * environment links to its own hosts, except `local`, which links to dev because
 * users cannot be sent to localhost. Use this table for every link the running
 * instance renders.
 */
const LINKED_ENVIRONMENT: Record<Environment, SwitchableEnvironment> = {
  local: "dev",
  dev: "dev",
  staging: "staging",
  production: "production",
};

/**
 * The app switcher links for each environment. They are computed once when the
 * module loads, so rendering a header does not compute them again.
 */
export const PORTAL_APPLICATIONS: Record<Environment, PortalApplication[]> = {
  local: resolve(LINKED_ENVIRONMENT.local),
  dev: resolve(LINKED_ENVIRONMENT.dev),
  staging: resolve(LINKED_ENVIRONMENT.staging),
  production: resolve(LINKED_ENVIRONMENT.production),
};

/**
 * Each application's URLs, keyed by id. The keys are the known ids, not `string`,
 * so a lookup with a known id always finds an entry. If an application is removed
 * from the list, every link to it fails at compile time instead of being
 * `undefined` at runtime.
 *
 * Each entry only has the environments the application has hosts for. A link to an
 * application deployed everywhere is a `string`. A link to one that is only
 * deployed in some environments must be checked first.
 *
 * `Object.fromEntries` always returns `string` keys, so the table below needs a
 * type assertion to get this type.
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
 * Returns the application's URL in each environment it is deployed to. Returns
 * undefined when the id is missing or unknown, or when the application has no host
 * in the given environment. The user can only switch away from an environment the
 * application runs in.
 *
 * The returned object is shared by all renders, so it is readonly. Changing it
 * would change the links in every later render.
 */
export function portalApplicationUrls(
  id: string | undefined,
  environment: Environment,
): ApplicationUrls | undefined {
  if (id === undefined || !isPortalApplicationId(id)) return undefined;
  const urls: ApplicationUrls = APPLICATION_URLS[id];
  return urls[LINKED_ENVIRONMENT[environment]] === undefined ? undefined : urls;
}

/** The ids of the applications that have a host in every environment. */
type FullyDeployedApplicationId = Extract<
  (typeof APPLICATIONS)[number],
  { hosts: Required<Hosts> }
>["id"];

/**
 * Returns the application's URL in the given environment, to use as the base for a
 * link to one of its pages. `local` gets the dev URL.
 *
 * It only accepts applications deployed in every environment, so the result is
 * never missing and callers need no check.
 */
export function portalApplicationUrl(
  id: FullyDeployedApplicationId,
  environment: Environment,
): string {
  return APPLICATION_URLS[id][LINKED_ENVIRONMENT[environment]];
}

const APP_NAMES = new Map<string, string>(APPLICATIONS.map(({ id, appName }) => [id, appName]));

/** Returns the application name shown next to the logo, or undefined for an unknown id. */
export function portalApplicationName(id?: string): string | undefined {
  return id === undefined ? undefined : APP_NAMES.get(id);
}

/** Returns the path the logo links to. It is "/" for an unknown or missing id. */
export function portalApplicationPath(id?: string): string {
  return APPLICATIONS_WITH_URLS.find((app) => app.id === id)?.path ?? "/";
}
