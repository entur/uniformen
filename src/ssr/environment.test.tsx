import { describe, expect, test } from "bun:test";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { TopNavigation } from "./TopNavigation";
import { renderComponentToString } from "./renderComponentToString";
import { buildRootVars, envStripHeight } from "./uniformenStyles";
import type { Environment } from "../config";
import { PORTAL_APPLICATIONS, type PortalApplicationId } from "../components/portalApplications";
import type { Locale } from "../types";

// The test server always runs as dev (see test/authTestSetup). These tests render
// the environment-dependent components directly, so they can cover production too.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

/** Returns the hrefs in document order. The switcher only links to its environment rows. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

/** Returns the text of each environment row in document order. The regex matches the
    whole opening tag, so it still works if the JSX props change order. */
const labels = (html: string): string[] =>
  [...html.matchAll(/<a[^>]*data-uniformen-env-switcher-link[^>]*>([^<]+)</g)].map(
    (match) => match[1] as string,
  );

/** Renders the badge in Bokmål unless the test passes a locale. */
const render = (
  props: { environment?: Environment; activeAppId?: PortalApplicationId; locale?: Locale } = {},
) => renderComponentToString(<EnvironmentBadge locale="nb-NO" {...props} />);

describe("who the chip is rendered for", () => {
  const bar = (props: { isEnturUser?: boolean; activeAppId?: PortalApplicationId }) =>
    renderComponentToString(<TopNavigation locale="nb-NO" {...props} />);

  test("an Entur user, and nobody else", async () => {
    expect(await bar({ isEnturUser: true })).toContain('class="uniformen-env-badge"');
    for (const props of [{}, { isEnturUser: false }]) {
      const html = await bar(props);
      expect(html).not.toContain("uniformen-env-badge");
      expect(html).not.toContain("uniformen-env-switcher");
    }
  });

  test("naming an app is not what admits you to it", async () => {
    const html = await bar({ activeAppId: "nplan" });
    expect(html).not.toContain("data-uniformen-env-switcher-toggle");
    expect(html).not.toContain("nplan");
  });

  test("the logo keeps its place either way", async () => {
    for (const props of [{ isEnturUser: true }, {}]) {
      expect(await bar(props)).toContain('class="uniformen-logo"');
    }
  });
});

describe("environment strip height", () => {
  test("production has no strip", () => {
    expect(envStripHeight("production")).toBe("0rem");
  });

  test("every environment carries a unit, so calc() stays valid", () => {
    for (const env of ENVIRONMENTS) {
      expect(envStripHeight(env)).toMatch(/^\d+(\.\d+)?(rem|px)$/);
    }
  });
});

describe("root vars per environment", () => {
  test("each environment resolves a full palette and strip height", () => {
    for (const env of ENVIRONMENTS) {
      const vars = buildRootVars(env);
      for (const name of [
        "--uniformen-color-env:",
        "--uniformen-color-env-tint:",
        "--uniformen-color-env-border:",
        "--uniformen-color-env-text:",
      ]) {
        expect(vars).toContain(name);
      }
      expect(vars).toContain(`--uniformen-env-strip-height: ${envStripHeight(env)}`);
      // The regex matches a variable whose value is empty or `undefined`.
      expect(vars).not.toMatch(/:\s*(undefined)?;/);
    }
  });
});

describe("environment badge", () => {
  test("production drops the strip pointer", async () => {
    const html = await render({ environment: "production" });
    expect(html).toContain('data-uniformen-environment="production"');
    expect(html).toContain(">PROD<");
    expect(html).not.toContain("uniformen-env-badge__pointer");
  });

  test("the other environments keep it", async () => {
    for (const env of ENVIRONMENTS.filter((e) => e !== "production")) {
      const html = await render({ environment: env });
      expect(html).toContain("uniformen-env-badge__pointer");
    }
  });

  test("the environment is named once, in one label at every width", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await render({ environment: env });
      expect(html.match(/uniformen-env-badge__label/g)).toHaveLength(1);
      expect(html).not.toMatch(/aria-hidden="true">[^<]/);
    }
    const staging = await render({ environment: "staging" });
    expect(staging).toContain('class="uniformen-env-badge__label">STAGING');
  });

  test("without an application the chip is static: no host to switch between", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await render({ environment: env });
      expect(html).not.toContain("uniformen-env-switcher");
      expect(html).not.toContain("<button");
      expect(html).not.toContain("href=");
    }
  });
});

describe("environment switcher", () => {
  test("the chip becomes a control once the consumer names its application", async () => {
    const html = await render({ environment: "staging", activeAppId: "cleos" });
    expect(html).toContain("data-uniformen-env-switcher-toggle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="uniformen-environment-switcher-panel"');
    expect(html).toContain('id="uniformen-environment-switcher-panel"');
    expect(html).toContain('class="uniformen-env-badge__label">STAGING');
    expect(html).not.toContain('aria-label="Miljø');
  });

  test("the same application in each environment", async () => {
    const html = await render({ environment: "staging", activeAppId: "cleos" });
    expect(hrefs(html)).toEqual([
      "https://cleos-client.dev.entur.io",
      "https://cleos-client.staging.entur.io",
      "https://cleos.entur.org",
    ]);
    expect(labels(html)).toEqual(["DEV", "STAGING", "PROD"]);
  });

  test("the order does not depend on which environment is served", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await render({ environment: env, activeAppId: "nplan" });
      expect(labels(html)).toEqual(["DEV", "STAGING", "PROD"]);
      expect(hrefs(html)).toEqual([
        "https://nplan.dev.entur.org",
        "https://nplan.staging.entur.org",
        "https://nplan.entur.org",
      ]);
    }
  });

  test("local has no row of its own, so nothing is marked current", async () => {
    const html = await render({ environment: "local", activeAppId: "sorvis" });
    expect(html).not.toContain('aria-current="page"');
    expect(html).not.toContain("uniformen-env-switcher__item--current");
  });

  test("the environment served is the marked one, exactly once", async () => {
    for (const env of ENVIRONMENTS.filter((e) => e !== "local")) {
      const html = await render({ environment: env, activeAppId: "ops-center" });
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html.match(/uniformen-env-switcher__item--current/g)).toHaveLength(1);
      // Check that the marker is on this environment's row, not just on the first row.
      const url = PORTAL_APPLICATIONS[env].find(({ id }) => id === "ops-center")?.url;
      const marked = html.split("<li").find((row) => row.includes('aria-current="page"'));
      expect(marked).toContain(`href="${url}"`);
    }
  });

  test("every link is retargetable, so the handler can graft the current path on", async () => {
    const html = await render({ environment: "dev", activeAppId: "partner" });
    expect(html.match(/data-uniformen-env-switcher-link/g)).toHaveLength(3);
  });

  test("an application offers only the environments it is deployed to", async () => {
    for (const env of ["staging", "production"] as const) {
      const html = await render({ environment: env, activeAppId: "skoleskyss" });
      expect(labels(html)).toEqual(["STAGING", "PROD"]);
      expect(hrefs(html)).toEqual([
        "https://skoleskyss.staging.entur.no",
        "https://skoleskyss.entur.no",
      ]);
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    }
  });

  test("an environment the application is not deployed to keeps the static chip", async () => {
    for (const env of ["local", "dev"] as const) {
      const html = await render({ environment: env, activeAppId: "skoleskyss" });
      expect(html).not.toContain("uniformen-env-switcher");
      expect(html).not.toContain("href=");
      expect(html).toContain('class="uniformen-env-badge"');
    }
  });

  test("an application the portal does not know about keeps the static chip", async () => {
    const html = await render({
      environment: "dev",
      // This is not a PortalApplicationId. It stands for an old `app` value that a
      // consumer might still send.
      activeAppId: "retired-app" as PortalApplicationId,
    });
    expect(html).not.toContain("uniformen-env-switcher");
    expect(html).toContain('class="uniformen-env-badge"');
  });
});
