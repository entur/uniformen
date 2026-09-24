import { AppSwitcher } from "../components/AppSwitcher";
import { portalApplicationPath, type PortalApplicationId } from "../components/portalApplications";
import type { Locale } from "../types";
import { NotificationsButton } from "../components/NotificationsButton";
import { SidebarToggle } from "../components/SidebarToggle";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { LogInIcon } from "../components/icons/LogInIcon";
import { UserMenu, type UserMenuUser } from "../components/UserMenu";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { NavigationLogo } from "./NavigationLogo";

const NOTIFICATIONS_ENABLED = false; // TODO: remove this when the notifications is ready for production

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
  isEnturUser,
  appName,
  activeAppId,
  sidebar,
  simple,
  contrast,
  locale,
  availableLocales,
  loginUrl,
  logoutUrl,
}: {
  /** The signed-in user. Without it, the bar is rendered for an anonymous user. */
  user?: UserMenuUser;
  /** The target of the login link on the anonymous bar. Without it, there is no link. */
  loginUrl?: string;
  /** The target of the logout row in the user menu. Without it, there is no row. */
  logoutUrl?: string;
  /**
   * Whether the user is in the Entur organisation. Only these users see the
   * environment chip and switcher. Other users should not see or switch between
   * environments.
   */
  isEnturUser?: boolean;
  appName?: string;
  /** The portal application this header is rendered for. */
  activeAppId?: PortalApplicationId;
  /**
   * Whether to render the button that collapses the side navigation. Set it when the
   * app has a sidebar. The server does not know if the sidebar is collapsed. That
   * state is set on the root element in the browser before the first paint.
   */
  sidebar?: boolean;
  /**
   * Renders a simpler bar. It hides the app switcher, notifications and the sidebar
   * toggle. The user menu only shows the user's name and email, plus the logout row
   * and language options when `logoutUrl` and `availableLocales` are set.
   */
  simple?: boolean;
  /**
   * Uses the design system's contrast colours, for apps with a dark page behind the
   * header. It only adds a class. The panels get the colours through CSS variables,
   * so no component needs to know about contrast mode.
   */
  contrast?: boolean;
  /** The language every string in the bar is rendered in. */
  locale: Locale;
  /**
   * The languages to offer, in this order. Without it, or when it is empty, there is
   * no language switcher. For a signed-in user it is a section in the user menu. For
   * an anonymous user it is a separate control in the bar.
   */
  availableLocales?: Locale[];
}) {
  const txt = texts[locale];
  // Also narrows the type, because `LocaleSwitcher` needs a defined list.
  const hasLocales = availableLocales !== undefined && availableLocales.length > 0;
  return (
    <header
      id="top-navigation"
      class={`uniformen-top-nav${contrast ? " uniformen-top-nav--contrast" : ""}`}
    >
      <nav class="uniformen-top-nav__nav" aria-label={txt.toppnavigasjon}>
        <div class="uniformen-top-nav__left">
          {sidebar && <SidebarToggle locale={locale} />}
          <NavigationLogo appName={appName} href={portalApplicationPath(activeAppId)} />
          {isEnturUser && <EnvironmentBadge activeAppId={activeAppId} locale={locale} />}
        </div>
        <div class="uniformen-top-nav__right">
          {/* Only for anonymous users. Signed-in users get the language options in
              the user menu. */}
          {hasLocales && !user && (
            <LocaleSwitcher availableLocales={availableLocales} locale={locale} />
          )}
          {user && (
            <>
              {!simple && NOTIFICATIONS_ENABLED && <NotificationsButton locale={locale} />}
              <UserMenu
                user={user}
                simple={simple}
                locale={locale}
                availableLocales={availableLocales}
                logoutUrl={logoutUrl}
              />
            </>
          )}
          {!user && loginUrl && (
            <a class="uniformen-top-nav__login" href={loginUrl} aria-label={txt.loggInn}>
              <LogInIcon />
              <span class="uniformen-top-nav__action-label">{txt.loggInn}</span>
            </a>
          )}
          {/* Only for signed-in users, because every app in the list needs a login.
              The divider is only shown together with the app switcher. */}
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
