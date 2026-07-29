import type { Environment } from "../config";

/** One resolved link, as the app switcher panel renders it. */
export type PortalApplication = { id: PortalApplicationId; appName: string; url: string };

/** Host per environment. */
type Hosts = Record<"dev" | "staging" | "production", string>;

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

const resolve = (key: keyof Hosts): PortalApplication[] =>
  APPLICATIONS.map(({ id, appName, hosts }) => ({ id, appName, url: `https://${hosts[key]}` }));

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

const APP_NAMES = new Map<string, string>(APPLICATIONS.map(({ id, appName }) => [id, appName]));

/** The name an application goes by beside the logo. */
export function portalApplicationName(id?: string): string | undefined {
  return id === undefined ? undefined : APP_NAMES.get(id);
}
