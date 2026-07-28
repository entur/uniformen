import { environment as runningEnvironment, type Environment } from "../config";

/**
 * Badge labels per environment. The long form is what the design shows on a
 * wide viewport; the short form replaces it visually under the mobile
 * breakpoint, where the label column has to give way to the icons on the right.
 * The long form stays in the accessibility tree at every width — it is the
 * badge's only accessible text — so the short form is aria-hidden to keep the
 * environment from being announced twice.
 */
const ENV_LABELS: Record<Environment, { long: string; short: string }> = {
  local: { long: "LOCAL", short: "LOCAL" },
  dev: { long: "DEV", short: "DEV" },
  staging: { long: "STAGING", short: "STG" },
  production: { long: "PROD", short: "PROD" },
};

/**
 * Environment chip next to the logo, tinted by the env palette. Static by
 * design: it reports which environment the app is served from and nothing else.
 * The pointer is the tail of the coloured strip along the top of the header,
 * anchored to this element so it stays centred on the chip no matter how wide
 * the app name is. Production has no strip, so it gets no pointer either.
 *
 * The environment defaults to the one this instance serves; the prop exists so
 * every environment's rendering can be exercised from a test.
 */
export function EnvironmentBadge({
  environment = runningEnvironment,
}: {
  environment?: Environment;
}) {
  const { long, short } = ENV_LABELS[environment];

  return (
    <div class="uniformen-env-badge" data-uniformen-environment={environment}>
      {environment !== "production" && (
        <span class="uniformen-env-badge__pointer" aria-hidden="true"></span>
      )}
      <span class="uniformen-env-badge__label">{long}</span>
      <span class="uniformen-env-badge__label--short" aria-hidden="true">
        {short}
      </span>
    </div>
  );
}
