import { environment as runningEnvironment, type Environment } from "../config";
import type { Locale } from "../types";
import { AppGridIcon } from "./icons/AppGridIcon";
import { PORTAL_APPLICATIONS, type PortalApplicationId } from "./portalApplications";

const texts = {
  "nb-NO": {
    velgApplikasjon: "Velg applikasjon",
    velgTjeneste: "Velg tjeneste",
  },
  "nn-NO": {
    velgApplikasjon: "Vel applikasjon",
    velgTjeneste: "Vel teneste",
  },
  "en-GB": {
    velgApplikasjon: "Choose application",
    velgTjeneste: "Choose service",
  },
} as const;

/**
 * Renders the app switcher. It only links to applications in the same environment
 * as the header, so a dev app links to the dev versions of the other apps.
 * `environment` defaults to the running environment. It is a prop so tests can
 * check the links for every environment.
 *
 * `activeAppId` is the application the header is rendered for, and its link is
 * marked as the current page. It is undefined when the app sends no `app` query
 * param. If the application is not in the list, no link is marked.
 */
export function AppSwitcher({
  activeAppId,
  environment = runningEnvironment,
  locale,
}: {
  activeAppId?: PortalApplicationId;
  environment?: Environment;
  locale: Locale;
}) {
  const applications = PORTAL_APPLICATIONS[environment];
  const txt = texts[locale];

  return (
    <div class="uniformen-app-switcher">
      <button
        type="button"
        class="uniformen-top-nav__action"
        aria-label={txt.velgApplikasjon}
        aria-expanded="false"
        aria-haspopup="dialog"
        aria-controls="uniformen-app-switcher-panel"
        data-uniformen-app-switcher-toggle
      >
        <AppGridIcon />
      </button>
      <div
        id="uniformen-app-switcher-panel"
        class="uniformen-app-switcher__panel"
        role="dialog"
        aria-label={txt.velgTjeneste}
      >
        <h2 class="uniformen-app-switcher__title">{txt.velgTjeneste}</h2>

        <div class="uniformen-app-switcher__body">
          <ul class="uniformen-app-switcher__list">
            {applications.map((app) => (
              <li key={app.id}>
                <a
                  href={app.url}
                  class={
                    activeAppId === app.id
                      ? "uniformen-app-switcher__item uniformen-app-switcher__item--active"
                      : "uniformen-app-switcher__item"
                  }
                  aria-current={activeAppId === app.id ? "page" : undefined}
                >
                  {app.appName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
