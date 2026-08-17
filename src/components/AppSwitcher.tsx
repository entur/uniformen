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
 * The switcher links to the environment the header is served from, never across
 * environments: a dev instance of an app hands its user dev instances of the
 * others. The environment defaults to the one this instance serves; the prop
 * exists so every environment's links can be exercised from a test.
 *
 * `activeAppId` is the application the header is being rendered for, marked as
 * the current page. Absent when the consumer sends no `app` query param, and
 * matching nothing when the named application is one the list leaves out here.
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
