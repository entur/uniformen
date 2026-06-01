import { AppSwitcher } from "../components/AppSwitcher";
import { Logo } from "./Logo";

export function TopNavigation() {
  return (
    <header id="top-navigation" class="uniformen-top-nav">
      <nav class="uniformen-top-nav__nav" aria-label="Toppnavigasjon">
        <div class="uniformen-top-nav__left">
          <AppSwitcher />
          <Logo appName="Uniformen" />
        </div>
        <div class="uniformen-top-nav__center"></div>
        <div class="uniformen-top-nav__right"></div>
      </nav>
    </header>
  );
}
