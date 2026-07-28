import { describe, expect, test } from "bun:test";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { renderComponentToString } from "./renderComponentToString";
import { buildRootVars, envStripHeight } from "./uniformenStyles";
import type { Environment } from "../config";

// The server resolves its environment once at startup, so the suite as a whole
// only ever runs as one of them (dev, see test/authTestSetup). These render the
// environment-dependent pieces directly, which is the only way to cover the
// production branch.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

describe("environment strip height", () => {
  test("production has no strip", () => {
    expect(envStripHeight("production")).toBe("0rem");
  });

  test("every environment carries a unit, so calc() stays valid", () => {
    // A unitless zero is a <number> inside calc(), not a <length>: the app
    // switcher panel's `top: calc(<height> + <strip> + <gap>)` would be invalid
    // and the panel would fall back to `top: auto`.
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
      // No var may resolve to the empty string or "undefined".
      expect(vars).not.toMatch(/:\s*(undefined)?;/);
    }
  });
});

describe("environment badge", () => {
  test("production drops the strip pointer", async () => {
    const html = await renderComponentToString(<EnvironmentBadge environment="production" />);
    expect(html).toContain('data-uniformen-environment="production"');
    expect(html).toContain(">PROD<");
    expect(html).not.toContain("uniformen-env-badge__pointer");
  });

  test("the other environments keep it", async () => {
    for (const env of ENVIRONMENTS.filter((e) => e !== "production")) {
      const html = await renderComponentToString(<EnvironmentBadge environment={env} />);
      expect(html).toContain("uniformen-env-badge__pointer");
    }
  });

  test("the short label is aria-hidden, so the environment is announced once", async () => {
    const html = await renderComponentToString(<EnvironmentBadge environment="staging" />);
    expect(html).toContain('class="uniformen-env-badge__label">STAGING');
    expect(html).toContain('class="uniformen-env-badge__label--short" aria-hidden="true">STG');
  });
});
