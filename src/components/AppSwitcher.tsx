import { AppGridIcon } from "./icons/AppGridIcon";

export type PortalApplication = { id: string; label: string; url: string };

export const PORTAL_APPLICATION_LIST: PortalApplication[] = [
  { id: "sorvis", label: "Sørvis", url: "https://sorvis.entur.io" },
  {
    id: "entur-partner",
    label: "Entur Partner",
    url: "https://entur-partner.entur.org",
  },
  {
    id: "skoleskyss",
    label: "Skoleskyss",
    url: "https://skoleskyss.entur.no",
  },
  { id: "nplan", label: "Nplan", url: "https://nplan.entur.org" },
  { id: "ops-center", label: "Ops Center", url: "https://ops-center.entur.io" },
];

export function AppSwitcher() {
  const activeAppId = "entur-partner";

  // TODO focus first item when opening
  // TODO close app switcher when clicking escape, and focus the open button

  return (
    <div class="uniformen-app-switcher">
      <button
        type="button"
        class="uniformen-top-nav__action"
        aria-label="Velg applikasjon"
        aria-expanded="false"
        aria-controls="app-switcher-panel"
        data-uniformen-app-switcher-toggle
      >
        <AppGridIcon />
        <span class="uniformen-top-nav__action-label">App</span>
      </button>
      <div
        id="app-switcher-panel"
        class="uniformen-app-switcher__panel"
        role="dialog"
        aria-label="Velg tjeneste"
      >
        <div class="uniformen-app-switcher__header">
          <h2 class="uniformen-app-switcher__title">Velg tjeneste</h2>

          <div class="uniformen-app-switcher__favorites-row">
            <span class="uniformen-app-switcher__section-label">Favoritter</span>
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
              Legg til
            </span>
          </div>
        </div>

        <div class="uniformen-app-switcher__body">
          <div class="uniformen-app-switcher__section-label uniformen-app-switcher__body-section-label">
            Alle tjenester
          </div>
          <ul class="uniformen-app-switcher__list">
            {PORTAL_APPLICATION_LIST.map((app) => (
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
                  {app.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
