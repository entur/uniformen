import { environment as runningEnvironment, type Environment } from "../config";
import { ChevronDownIcon } from "../components/icons/ChevronDownIcon";
import {
  portalApplicationUrls,
  SWITCHABLE_ENVIRONMENTS,
  type PortalApplicationId,
  type SwitchableEnvironment,
} from "../components/portalApplications";
import type { Locale } from "../types";

const texts = {
  "nb-NO": { byttMiljo: "Bytt miljø" },
  "nn-NO": { byttMiljo: "Byt miljø" },
  "en-GB": { byttMiljo: "Switch environment" },
} as const;

/**
 * Labels for the badge and the switcher rows. They are not translated. The label is
 * the chip's only text and the button's accessible name, so it is shown at every
 * screen width.
 */
const ENV_LABELS: Record<Environment, string> = {
  local: "LOCAL",
  dev: "DEV",
  staging: "STAGING",
  production: "PROD",
};

/**
 * Renders the chip next to the logo that shows which environment the app runs in.
 * When `activeAppId` has URLs for this environment, the chip is a button that opens
 * a list of links to the same app in the other environments. Otherwise it is a
 * plain chip.
 *
 * The pointer is placed inside the chip so it stays centred on it, however wide the
 * app name is. Production has no coloured strip, so it gets no pointer.
 *
 * `environment` defaults to the environment this instance runs in. Tests set it to
 * render the other environments.
 */
export function EnvironmentBadge({
  environment = runningEnvironment,
  activeAppId,
  locale,
}: {
  environment?: Environment;
  activeAppId?: PortalApplicationId;
  locale: Locale;
}) {
  const urls = portalApplicationUrls(activeAppId, environment);
  const txt = texts[locale];

  /* The rows are always in the same order, starting with dev, whichever
     environment this is. The current environment is marked, not moved. There is
     no row for local, because no user can be sent to localhost. */
  const rows: { env: SwitchableEnvironment; url: string }[] = [];
  for (const env of SWITCHABLE_ENVIRONMENTS) {
    const url = urls?.[env];
    if (url !== undefined) rows.push({ env, url });
  }

  const pointer = environment !== "production" && (
    <span class="uniformen-env-badge__pointer" aria-hidden="true"></span>
  );

  const label = <span class="uniformen-env-badge__label">{ENV_LABELS[environment]}</span>;

  if (!urls) {
    return (
      <div class="uniformen-env-badge" data-uniformen-environment={environment}>
        {pointer}
        {label}
      </div>
    );
  }

  return (
    <div class="uniformen-env-switcher" data-uniformen-environment={environment}>
      <button
        type="button"
        class="uniformen-env-badge uniformen-env-badge--interactive"
        aria-expanded="false"
        aria-haspopup="dialog"
        aria-controls="uniformen-environment-switcher-panel"
        data-uniformen-env-switcher-toggle
      >
        {pointer}
        {label}
        <ChevronDownIcon />
      </button>
      <div
        id="uniformen-environment-switcher-panel"
        class="uniformen-env-switcher__panel"
        role="dialog"
        aria-label={txt.byttMiljo}
      >
        <ul class="uniformen-env-switcher__list">
          {rows.map(({ env, url }) => (
            <li key={env}>
              {/* The href is the front page of the target environment. It is
                  used when scripts do not run. With scripts, `retargetEnvironmentLinks`
                  changes it to the current page each time the panel opens. */}
              <a
                href={url}
                class={
                  env === environment
                    ? "uniformen-env-switcher__item uniformen-env-switcher__item--current"
                    : "uniformen-env-switcher__item"
                }
                aria-current={env === environment ? "page" : undefined}
                data-uniformen-env-switcher-link
              >
                {ENV_LABELS[env]}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
