import { environment as runningEnvironment, type Environment } from "../config";
import type { Locale } from "../types";
import { LocaleMenu } from "./LocaleMenu";
import { UserIcon } from "./icons/UserIcon";
import { EyeIcon } from "./icons/EyeIcon";
import { portalApplicationUrl } from "./portalApplications";

const texts = {
  "nb-NO": {
    mineTilganger: "Mine tilganger",
    loggUt: "Logg ut",
    brukermeny: "Brukermeny",
  },
  "nn-NO": {
    mineTilganger: "Mine tilgangar",
    loggUt: "Logg ut",
    brukermeny: "Brukarmeny",
  },
  "en-GB": {
    mineTilganger: "My access",
    loggUt: "Log out",
    brukermeny: "User menu",
  },
} as const;

/** The signed-in user shown in the header. */
export type UserMenuUser = { name: string; email?: string };

/** The Partner page where users see their own permissions and profile. */
const MY_PROFILE_PATH = "/permission-admin/my-profile";

/**
 * Renders the signed-in user's menu. It shows the user's name, a link to their
 * access, and a logout link. It is only rendered for signed-in users.
 *
 * The access link is an absolute URL in the current environment, so a dev header
 * links to dev Partner. The consuming app gives the logout URL, because the session
 * belongs to the app, not to Uniformen.
 *
 * `environment` defaults to the running environment. It is a prop so tests can
 * check the links for every environment.
 */
export function UserMenu({
  user,
  environment = runningEnvironment,
  simple,
  locale,
  availableLocales,
  logoutUrl,
}: {
  user: UserMenuUser;
  environment?: Environment;
  /**
   * Renders a minimal menu with the user's name and the logout link, but without the
   * access link. The name stays, because at mobile widths the button only shows an
   * icon, and the panel is the only place to see who is signed in.
   */
  simple?: boolean;
  locale: Locale;
  /**
   * The languages to offer, in this order. If it is empty or missing, no language
   * switcher is shown, because an app without translations must not offer one.
   */
  availableLocales?: Locale[];
  /** The URL of the logout link. If it is missing, no logout link is shown. */
  logoutUrl?: string;
}) {
  const txt = texts[locale];
  return (
    <div class="uniformen-user-menu">
      {/* No aria-label, because the name inside the button is its accessible name.
          At mobile widths the name is only hidden visually, so screen readers still read it. */}
      <button
        type="button"
        class="uniformen-top-nav__user"
        aria-expanded="false"
        aria-haspopup="dialog"
        aria-controls="uniformen-user-menu-panel"
        data-uniformen-user-menu-toggle
      >
        <UserIcon />
        <span class="uniformen-top-nav__user-name">{user.name}</span>
      </button>
      <div
        id="uniformen-user-menu-panel"
        class={
          simple
            ? "uniformen-user-menu__panel uniformen-user-menu__panel--simple"
            : "uniformen-user-menu__panel"
        }
        role="dialog"
        aria-label={txt.brukermeny}
      >
        {/* This repeats the name from the button. At mobile widths the button only
            shows an icon, so this is the only place to see who is signed in. */}
        <div class="uniformen-user-menu__identity">
          <span class="uniformen-user-menu__name">{user.name}</span>
          {user.email && <span class="uniformen-user-menu__email">{user.email}</span>}
        </div>
        {!simple && (
          <ul class="uniformen-user-menu__list">
            <li>
              <a
                class="uniformen-user-menu__item"
                href={`${portalApplicationUrl("partner", environment)}${MY_PROFILE_PATH}`}
              >
                <EyeIcon />
                {txt.mineTilganger}
              </a>
            </li>
          </ul>
        )}
        {/* The language options are shown in the `simple` menu too. Otherwise the bar
            would need a separate language button next to the user menu. See
            `LocaleSwitcher`. */}
        {availableLocales && availableLocales.length > 0 && (
          <LocaleMenu availableLocales={availableLocales} locale={locale} />
        )}
        {/* Logout is in its own group below a divider, because logging out is a
            different kind of action from the items above. */}
        {logoutUrl && (
          <a class="uniformen-user-menu__item uniformen-user-menu__logout" href={logoutUrl}>
            {txt.loggUt}
          </a>
        )}
      </div>
    </div>
  );
}
