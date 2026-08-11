import { AppSwitcher } from "../components/AppSwitcher";
import type { PortalApplicationId } from "../components/portalApplications";
import type { Locale } from "../types";
import { NotificationsButton } from "../components/NotificationsButton";
import { SidebarToggle } from "../components/SidebarToggle";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { LogInIcon } from "../components/icons/LogInIcon";
import { UserMenu, type UserMenuUser } from "../components/UserMenu";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { Logo } from "./Logo";

const texts = {
  "nb-NO": {
    loggInn: "Logg inn",
    toppnavigasjon: "Toppnavigasjon",
  },
  "nn-NO": {
    loggInn: "Logg inn",
    toppnavigasjon: "Toppnavigasjon",
  },
  "en-GB": {
    loggInn: "Log in",
    toppnavigasjon: "Top navigation",
  },
} as const;

export function TopNavigation({
  user,
  appName,
  activeAppId,
  sidebar,
  simple,
  locale,
  availableLocales,
}: {
  /** The signed-in user. Absent renders the anonymous bar, with a login link. */
  user?: UserMenuUser;
  appName?: string;
  /** The portal application this header is rendered for. */
  activeAppId?: PortalApplicationId;
  /**
   * Whether to render the side navigation collapse control. Off means the app has
   * no sidebar. The control's state is not ours to know: it lives on the root
   * element, restored client-side before paint.
   */
  sidebar?: boolean;
  /**
   * Barebones bar: hides the app switcher, notifications and the sidebar toggle, and
   * thins the user menu to logout. Left side untouched, env switcher included.
   */
  simple?: boolean;
  /** The language every string in the bar is rendered in. */
  locale: Locale;
  /**
   * The languages to offer in the user menu's switcher, in this order. Empty or
   * absent renders no switcher. Where the bar has a user menu it is a section of
   * that, `simple` or not; on an anonymous bar, which has none, it is a control of
   * its own.
   */
  availableLocales?: Locale[];
}) {
  const txt = texts[locale];
  // Narrows for the switcher below, which takes the list required.
  const hasLocales = availableLocales !== undefined && availableLocales.length > 0;
  return (
    <header id="top-navigation" class="uniformen-top-nav">
      <nav class="uniformen-top-nav__nav" aria-label={txt.toppnavigasjon}>
        <div class="uniformen-top-nav__left">
          {sidebar && <SidebarToggle locale={locale} />}
          <Logo appName={appName} />
          <EnvironmentBadge activeAppId={activeAppId} locale={locale} />
        </div>
        <div class="uniformen-top-nav__right">
          {/* Ahead of the identity controls: the language the page is in is chrome,
              not something about who is signed in. Rendered here only for the bars
              with no user menu to hold the switcher — see `LocaleSwitcher`. */}
          {hasLocales && !user && (
            <LocaleSwitcher availableLocales={availableLocales} locale={locale} />
          )}
          {user ? (
            <>
              {!simple && <NotificationsButton locale={locale} />}
              <UserMenu
                user={user}
                simple={simple}
                locale={locale}
                availableLocales={availableLocales}
              />
            </>
          ) : (
            <a class="uniformen-top-nav__login" href="/auth/login" aria-label={txt.loggInn}>
              <LogInIcon />
              <span class="uniformen-top-nav__action-label">{txt.loggInn}</span>
            </a>
          )}
          {/* Signed in only: every app it lists is behind a login. The divider is
              the switcher's, not the bar's, so it comes and goes with it. */}
          {user && !simple && (
            <>
              <span class="uniformen-top-nav__divider" aria-hidden="true"></span>
              <AppSwitcher activeAppId={activeAppId} locale={locale} />
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
