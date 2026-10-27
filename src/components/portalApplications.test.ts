import { describe, expect, test } from "bun:test";
import {
  PORTAL_APPLICATION_IDS,
  PORTAL_APPLICATIONS,
  linkedEnvironment,
  portalApplicationName,
  portalApplicationPath,
  portalApplicationUrl,
  portalApplicationUrls,
} from "./portalApplications";
import type { Environment } from "../config";

const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

describe("registry rules", () => {
  test("ids are unique", () => {
    expect(new Set(PORTAL_APPLICATION_IDS).size).toBe(PORTAL_APPLICATION_IDS.length);
  });

  test("every application has a unique name", () => {
    const names = PORTAL_APPLICATION_IDS.map((id) => portalApplicationName(id));
    for (const name of names) expect(name).toBeTruthy();
    expect(new Set(names).size).toBe(names.length);
  });

  test("applications are sorted by name in Norwegian alphabetical order", () => {
    // The Norwegian collator puts Æ, Ø and Å after Z.
    const names = PORTAL_APPLICATION_IDS.map((id) => portalApplicationName(id) as string);
    expect(names).toEqual(names.toSorted(new Intl.Collator("nb").compare));
  });

  test("every application is deployed somewhere, and only to https URLs", () => {
    for (const id of PORTAL_APPLICATION_IDS) {
      const urls = Object.values(portalApplicationUrls(id) ?? {});
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]+(\/[a-z0-9-]+)*$/);
      }
    }
  });

  test("each URL belongs to the environment it is listed under", () => {
    // This catches an entry that was copied from another environment and still
    // points at that environment's host.
    for (const id of PORTAL_APPLICATION_IDS) {
      const { dev, staging, production } = portalApplicationUrls(id) ?? {};
      if (dev !== undefined) expect(dev).toContain(".dev.");
      if (staging !== undefined) expect(staging).toContain(".staging.");
      if (production !== undefined) expect(production).not.toMatch(/\.(dev|staging)\./);
    }
  });
});

describe("app switcher list", () => {
  test("includes a listed application in every environment it is deployed to", () => {
    // The other tests here loop over the entries, so they would also pass on an
    // empty list.
    for (const env of ENVIRONMENTS) {
      expect(PORTAL_APPLICATIONS[env].map((app) => app.id)).toContain("nplan");
    }
  });

  test("each entry links to the application in the switcher's own environment", () => {
    for (const env of ["dev", "staging", "production"] as const) {
      for (const { id, appName, url } of PORTAL_APPLICATIONS[env]) {
        expect(url).toBe(portalApplicationUrls(id)?.[env] as string);
        expect(appName).toBe(portalApplicationName(id) as string);
      }
    }
  });

  test("keeps the registry order", () => {
    for (const env of ENVIRONMENTS) {
      const ids = PORTAL_APPLICATIONS[env].map((app) => app.id);
      const positions = ids.map((id) => PORTAL_APPLICATION_IDS.indexOf(id));
      expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    }
  });

  test("links are unique", () => {
    for (const env of ENVIRONMENTS) {
      const urls = PORTAL_APPLICATIONS[env].map((app) => app.url);
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  test("local uses the dev list, so a locally served header never links to production", () => {
    expect(PORTAL_APPLICATIONS.local).toEqual(PORTAL_APPLICATIONS.dev);
  });

  test("leaves out an unlisted application", () => {
    for (const env of ENVIRONMENTS) {
      expect(PORTAL_APPLICATIONS[env].map((app) => app.id)).not.toContain("skoleskyss");
    }
  });
});

describe("portalApplicationUrls", () => {
  test("returns the URL in every environment of a fully deployed application", () => {
    expect(portalApplicationUrls("nplan")).toEqual({
      dev: "https://nplan.dev.entur.org",
      staging: "https://nplan.staging.entur.org",
      production: "https://nplan.entur.org",
    });
  });

  test("returns only the environments the application is deployed to", () => {
    expect(portalApplicationUrls("skoleskyss")).toEqual({
      staging: "https://skoleskyss.staging.entur.no",
      production: "https://skoleskyss.entur.no",
    });
  });

  test("returns undefined for a missing, unknown or wrongly cased id", () => {
    expect(portalApplicationUrls(undefined)).toBeUndefined();
    expect(portalApplicationUrls("retired-app")).toBeUndefined();
    expect(portalApplicationUrls("Skoleskyss")).toBeUndefined();
  });

  test("Bedrift's URLs include its path", () => {
    expect(portalApplicationUrls("bedrift")).toEqual({
      staging: "https://skoleskyss.staging.entur.no/bedrift",
      production: "https://skoleskyss.entur.no/bedrift",
    });
  });
});

describe("linkedEnvironment", () => {
  test("local links to dev, and every other environment links to itself", () => {
    expect(linkedEnvironment("local")).toBe("dev");
    for (const env of ["dev", "staging", "production"] as const) {
      expect(linkedEnvironment(env)).toBe(env);
    }
  });
});

describe("portalApplicationUrl", () => {
  test("returns the URL for the given environment", () => {
    expect(portalApplicationUrl("cleos", "dev")).toBe("https://cleos-client.dev.entur.io");
    expect(portalApplicationUrl("cleos", "staging")).toBe("https://cleos-client.staging.entur.io");
    expect(portalApplicationUrl("cleos", "production")).toBe("https://cleos.entur.org");
  });

  test("local uses dev", () => {
    expect(portalApplicationUrl("cleos", "local")).toBe(portalApplicationUrl("cleos", "dev"));
  });
});

describe("portalApplicationName", () => {
  test("returns the name of a known application", () => {
    expect(portalApplicationName("sorvis")).toBe("Sørvis");
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
    // Partner's host has the `entur-` prefix, but its id does not.
    expect(portalApplicationName("entur-partner")).toBeUndefined();
  });
});

describe("portalApplicationPath", () => {
  test("returns the path of an app served below the root of its host", () => {
    expect(portalApplicationPath("bedrift")).toBe("/bedrift");
  });

  test("returns / for an app served at the root, for a missing id and for an unknown id", () => {
    expect(portalApplicationPath("partner")).toBe("/");
    expect(portalApplicationPath()).toBe("/");
    expect(portalApplicationPath("unknown")).toBe("/");
  });
});
