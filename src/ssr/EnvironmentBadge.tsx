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
 * Badge labels per environment. One form at every width: the label is the chip's
 * only text, and — once the chip is a button — its accessible name, so it is
 * rendered rather than hidden even under the mobile breakpoint where the app name
 * gives way. The panel rows read the same values. Untranslated.
 */
const ENV_LABELS: Record<Environment, string> = {
  local: "LOCAL",
  dev: "DEV",
  staging: "STAGING",
  production: "PROD",
};

/**
 * Environment chip next to the logo, tinted by the env palette. It reports which
 * environment the app is served from, and — when the consumer names its
 * application — doubles as a switcher to the same app in another environment.
 * The pointer is the tail of the coloured strip along the top of the header,
 * anchored to this element so it stays centred on the chip no matter how wide
 * the app name is. Production has no strip, so it gets no pointer either.
 *
 * The environment defaults to the one this instance serves; the prop exists so
 * every environment's rendering can be exercised from a test.
 *
 * `activeAppId` is the application the header is being rendered for. Without hosts
 * for it there is nothing to switch between, so the badge renders as the static
 * chip it was before — the app switcher's `app` query param is what turns it into
 * a control.
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

  /* Fixed order, dev outwards: the rows sit in the same place whichever
     environment the header is served from, so the list is a map rather than
     something that reshuffles per instance. The one being served is marked, not
     moved. A local instance has no row — nobody can be sent to localhost — so it
     marks none of them. */
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
              {/* The href is the target environment's bare host: it is the
                  no-script fallback, and the only landing page that is correct
                  without knowing where the user currently is. With scripts, the
                  handler rewrites it to the page they are on. */}
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
