import { AppSwitcher } from "../components/AppSwitcher";
import type { PortalApplicationId } from "../components/portalApplications";
import { NotificationsButton } from "../components/NotificationsButton";
import { SidebarToggle } from "../components/SidebarToggle";
import { LogInIcon } from "../components/icons/LogInIcon";
import { UserIcon } from "../components/icons/UserIcon";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { Logo } from "./Logo";

export function TopNavigation({
  user,
  appName,
  activeAppId,
  sidebar,
}: {
  user?: string;
  appName?: string;
  /** The portal application this header is rendered for. */
  activeAppId?: PortalApplicationId;
  /**
   * Whether to render the side navigation collapse control. Off means the app has
   * no sidebar. The control's state is not ours to know: it lives on the root
   * element, restored client-side before paint.
   */
  sidebar?: boolean;
}) {
  return (
    <header id="top-navigation" class="uniformen-top-nav">
      <nav class="uniformen-top-nav__nav" aria-label="Toppnavigasjon">
        <div class="uniformen-top-nav__left">
          {sidebar && <SidebarToggle />}
          <Logo appName={appName} />
          <EnvironmentBadge activeAppId={activeAppId} />
        </div>
        <div class="uniformen-top-nav__right">
          {user ? (
            <>
              <NotificationsButton />
              <span class="uniformen-top-nav__user">
                <UserIcon />
                <span class="uniformen-top-nav__user-name">{user}</span>
              </span>
            </>
          ) : (
            <a class="uniformen-top-nav__login" href="/auth/login" aria-label="Logg inn">
              <LogInIcon />
              <span class="uniformen-top-nav__action-label">Logg inn</span>
            </a>
          )}
          <span class="uniformen-top-nav__divider" aria-hidden="true"></span>
          <AppSwitcher activeAppId={activeAppId} />
        </div>
      </nav>
    </header>
  );
}
