import { AppSwitcher } from "../components/AppSwitcher";
import { LogInIcon } from "../components/icons/LogInIcon";
import { UserIcon } from "../components/icons/UserIcon";
import { Logo } from "./Logo";

export function TopNavigation({ user, appName }: { user?: string; appName?: string }) {
  return (
    <header id="top-navigation" class="uniformen-top-nav">
      <nav class="uniformen-top-nav__nav" aria-label="Toppnavigasjon">
        <div class="uniformen-top-nav__left">
          <AppSwitcher />
          <Logo appName={appName} />
        </div>
        <div class="uniformen-top-nav__center"></div>
        <div class="uniformen-top-nav__right">
          {user ? (
            <span class="uniformen-top-nav__user">
              <UserIcon />
              <span class="uniformen-top-nav__user-name">{user}</span>
            </span>
          ) : (
            <a class="uniformen-top-nav__login" href="/auth/login">
              <LogInIcon />
              <span>Logg inn</span>
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
