import { environment as runningEnvironment, type Environment } from "../config";
import type { Locale } from "../types";
import { AppGridIcon } from "./icons/AppGridIcon";
import { PORTAL_APPLICATIONS, type PortalApplicationId } from "./portalApplications";

const texts = {
  "nb-NO": {
    velgApplikasjon: "Velg applikasjon",
    velgTjeneste: "Velg tjeneste",
    favoritter: "Favoritter",
    leggTil: "Legg til",
    alleTjenester: "Alle tjenester",
  },
  "nn-NO": {
    velgApplikasjon: "Vel applikasjon",
    velgTjeneste: "Vel teneste",
    favoritter: "Favorittar",
    leggTil: "Legg til",
    alleTjenester: "Alle tenester",
  },
  "en-GB": {
    velgApplikasjon: "Choose application",
    velgTjeneste: "Choose service",
    favoritter: "Favourites",
    leggTil: "Add",
    alleTjenester: "All services",
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
 * matching nothing in environments the named application is not deployed to.
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

  // TODO focus first item when opening
  // TODO close app switcher when clicking escape, and focus the open button
  // TODO on click handler for removing an app from favorites

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
        <div class="uniformen-app-switcher__header">
          <h2 class="uniformen-app-switcher__title">{txt.velgTjeneste}</h2>

          <div class="uniformen-app-switcher__favorites-row">
            <span class="uniformen-app-switcher__section-label">{txt.favoritter}</span>
            <span class="uniformen-app-switcher__add-favorite" aria-hidden="true">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                width="1em"
                height="1em"
                color="currentColor"
              >
                <path
                  fill="currentColor"
                  fill-rule="evenodd"
                  d="m8.7 1-.001 6.3H15v1.4H8.699L8.7 15H7.3V8.7H1V7.3h6.3V1z"
                  clip-rule="evenodd"
                />
              </svg>
              {txt.leggTil}
            </span>
          </div>
        </div>

        <div class="uniformen-app-switcher__body">
          <div class="uniformen-app-switcher__section-label uniformen-app-switcher__body-section-label">
            {txt.alleTjenester}
          </div>
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
