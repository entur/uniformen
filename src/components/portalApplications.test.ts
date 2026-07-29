import { describe, expect, test } from "bun:test";
import {
  PORTAL_APPLICATION_IDS,
  PORTAL_APPLICATIONS,
  portalApplicationName,
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
    // new application is accepted as a query value by being listed.
    expect([...PORTAL_APPLICATION_IDS]).toEqual(PORTAL_APPLICATIONS.production.map((a) => a.id));
    expect(PORTAL_APPLICATION_IDS).toEqual(["cleos", "nplan", "ops-center", "partner", "sorvis"]);
  });

  test("ids are unique", () => {
    expect(new Set(PORTAL_APPLICATION_IDS).size).toBe(PORTAL_APPLICATION_IDS.length);
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
