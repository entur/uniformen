import { environment as runningEnvironment, type Environment } from "../config";
import type { Locale } from "../types";
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

/** The signed-in user, as the header labels them. */
export type UserMenuUser = { name: string; email?: string };

/** The user's own permissions and profile, a page of Partner. */
const MY_PROFILE_PATH = "/permission-admin/my-profile";

/**
 * The signed-in user's menu: who you are, where to see what you have access to,
 * and the way out. Rendered only for an authenticated user — there is no anonymous
 * form of it, the login link is that.
 *
 * The account link is absolute and per environment, like the app switcher's:
 * a dev header hands its user dev Partner. Logging out is relative, like logging
 * in — the session belongs to the consuming app, not to us.
 *
 * The environment defaults to the one this instance serves; the prop exists so
 * every environment's links can be exercised from a test.
 */
export function UserMenu({
  user,
  environment = runningEnvironment,
  simple,
  locale,
}: {
  user: UserMenuUser;
  environment?: Environment;
  /**
   * Barebones menu: who you are and the way out, no links. Keeps the identity
   * block — under the mobile breakpoint the chip is an icon alone, so the panel is
   * the only place the user can read who they are signed in as.
   */
  simple?: boolean;
  locale: Locale;
}) {
  const txt = texts[locale];
  return (
    <div class="uniformen-user-menu">
      {/* No aria-label: the name is the accessible name, and it survives the
          mobile breakpoint that hides it visually. */}
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
        {/* Repeats the name the chip already shows: at mobile widths the chip is
            an icon alone, and this is then the only place the user can read who
            they are signed in as. */}
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
        {/* Its own group, below a divider: leaving is not one more place to go. */}
        <a class="uniformen-user-menu__item uniformen-user-menu__logout" href="/auth/logout">
          {txt.loggUt}
        </a>
      </div>
    </div>
  );
}
