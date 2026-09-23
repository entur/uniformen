import { describe, expect, test } from "bun:test";
import {
  PORTAL_APPLICATION_IDS,
  PORTAL_APPLICATIONS,
  portalApplicationName,
  portalApplicationUrl,
  portalApplicationUrls,
} from "./portalApplications";
import { expectedUrls } from "../test/expectedPortalUrls";
import type { Environment } from "../config";

const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

describe("portal application links per environment", () => {
  test("each environment resolves its own list of links", () => {
    for (const env of ENVIRONMENTS) {
      expect(PORTAL_APPLICATIONS[env].map((app) => app.url)).toEqual(expectedUrls(env));
    }
  });

  test("local rides dev, so a locally served header never links to production", () => {
    expect(PORTAL_APPLICATIONS.local).toEqual(PORTAL_APPLICATIONS.dev);
  });

  test("no environment links to a host of another", () => {
    // Catches the copy-paste miss: an entry left pointing at production (or at
    // dev) in a list that belongs to a different environment.
    for (const env of ENVIRONMENTS) {
      const own = new Set(expectedUrls(env));
      for (const { url } of PORTAL_APPLICATIONS[env]) {
        expect(own.has(url)).toBe(true);
      }
    }
  });

  test("every link is a unique absolute https url", () => {
    for (const env of ENVIRONMENTS) {
      const urls = PORTAL_APPLICATIONS[env].map((app) => app.url);
      for (const url of urls) {
        expect(url.startsWith("https://")).toBe(true);
        // A misspelled host field would compose into a live-looking URL.
        expect(url).not.toMatch(/null|undefined/);
      }
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  test("identity does not move with the environment", () => {
    const names = new Map(PORTAL_APPLICATIONS.production.map(({ id, appName }) => [id, appName]));
    for (const env of ENVIRONMENTS) {
      // Every environment lists the same applications, in the same order, under
      // the same names. Only the hosts differ.
      expect(PORTAL_APPLICATIONS[env].map((app) => app.id)).toEqual([...names.keys()]);
      for (const { id, appName } of PORTAL_APPLICATIONS[env]) {
        expect(appName).toBe(names.get(id) as string);
      }
    }
  });
});

describe("application ids", () => {
  test("the accepted query values are the applications themselves", () => {
    // The `app` param and the switcher entry it marks are the same string, so a
    // new application is accepted as a query value by being listed — whether or
    // not the switcher offers it.
    expect(PORTAL_APPLICATION_IDS).toEqual([
      "bedrift",
      "cleos",
      "nplan",
      "ops-center",
      "partner",
      "skoleskyss",
      "sorvis",
    ]);
    for (const { id } of PORTAL_APPLICATIONS.production) {
      expect(PORTAL_APPLICATION_IDS).toContain(id);
    }
  });

  test("ids are unique", () => {
    expect(new Set(PORTAL_APPLICATION_IDS).size).toBe(PORTAL_APPLICATION_IDS.length);
  });
});

describe("unlisted applications", () => {
  test("Skoleskyss is known, and offered by no environment's switcher", () => {
    expect(PORTAL_APPLICATION_IDS).toContain("skoleskyss");
    for (const env of ENVIRONMENTS) {
      expect(PORTAL_APPLICATIONS[env].map((app) => app.id)).not.toContain("skoleskyss");
      expect(PORTAL_APPLICATIONS[env].map((app) => app.url)).not.toContain(
        "https://skoleskyss.entur.no",
      );
    }
  });

  test("its own links are the environments it is deployed to", () => {
    expect(portalApplicationUrls("skoleskyss", "production")).toEqual({
      staging: "https://skoleskyss.staging.entur.no",
      production: "https://skoleskyss.entur.no",
    });
  });

  test("an environment it is not deployed to hands out nothing to switch between", () => {
    // Local rides dev, and there is no dev deploy.
    for (const env of ["local", "dev"] as const) {
      expect(portalApplicationUrls("skoleskyss", env)).toBeUndefined();
    }
  });
});

describe("portalApplicationUrls", () => {
  test("a fully deployed application switches from every environment", () => {
    for (const env of ENVIRONMENTS) {
      expect(portalApplicationUrls("nplan", env)).toEqual({
        dev: "https://nplan.dev.entur.org",
        staging: "https://nplan.staging.entur.org",
        production: "https://nplan.entur.org",
      });
    }
  });

  test("no application, or one the portal does not know, switches from none", () => {
    for (const env of ENVIRONMENTS) {
      expect(portalApplicationUrls(undefined, env)).toBeUndefined();
      expect(portalApplicationUrls("retired-app", env)).toBeUndefined();
      expect(portalApplicationUrls("Skoleskyss", env)).toBeUndefined();
    }
  });
});

describe("portalApplicationUrl", () => {
  /** The ids the function accepts: the applications with a host in every environment. */
  const FULLY_DEPLOYED = ["cleos", "nplan", "ops-center", "partner", "sorvis"] as const;

  test("agrees with the list the switcher renders, for every app in every environment", () => {
    // Both read one host table, so this is what keeps a link to a page of an
    // application pointing at the same host the switcher sends people to.
    for (const env of ENVIRONMENTS) {
      for (const id of FULLY_DEPLOYED) {
        const url = PORTAL_APPLICATIONS[env].find((app) => app.id === id)?.url;
        expect(url).toBeDefined();
        expect(portalApplicationUrl(id, env)).toBe(url as string);
      }
    }
  });

  test("local rides dev here too", () => {
    for (const id of FULLY_DEPLOYED) {
      expect(portalApplicationUrl(id, "local")).toBe(portalApplicationUrl(id, "dev"));
      expect(portalApplicationUrl(id, "local")).not.toBe(portalApplicationUrl(id, "production"));
    }
  });
});

describe("portalApplicationName", () => {
  test("every application has a name for the logo slot", () => {
    for (const id of PORTAL_APPLICATION_IDS) {
      expect(portalApplicationName(id)).toBeTruthy();
    }
  });

  test("names the applications added alongside the per-environment links", () => {
    expect(portalApplicationName("partner")).toBe("Partner");
    expect(portalApplicationName("sorvis")).toBe("Sørvis");
    expect(portalApplicationName("cleos")).toBe("CLEOS");
    expect(portalApplicationName("nplan")).toBe("Nplan");
    expect(portalApplicationName("ops-center")).toBe("Ops Center");
    expect(portalApplicationName("skoleskyss")).toBe("Skoleskyss");
  });

  test("returns undefined when no app is given", () => {
    expect(portalApplicationName()).toBeUndefined();
    expect(portalApplicationName(undefined)).toBeUndefined();
  });

  test("returns undefined for unknown or wrongly cased ids", () => {
    expect(portalApplicationName("")).toBeUndefined();
    expect(portalApplicationName("unknown")).toBeUndefined();
    expect(portalApplicationName("Partner")).toBeUndefined();
    expect(portalApplicationName("PARTNER")).toBeUndefined();
    // Partner's host keeps the `entur-` prefix; the id it answers to does not.
    expect(portalApplicationName("entur-partner")).toBeUndefined();
  });
});
