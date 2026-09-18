import localeHandlers from "../components/localeHandlers.ts";
import panelToggle from "../components/panelToggle.ts";
import retargetEnvironmentLinks from "../components/retargetEnvironmentLinks.ts";
import { sha256Source } from "./sha256.ts";

// The handlers are emitted as the declarations they already are — `toString()` on a
// `function foo() {}` is source that declares `foo` — so the calls below are written
// out as the page will run them. Every panel in the top bar is one of those lines.
//
// Wrapped in an IIFE: a top-level declaration in a classic script is a binding the
// consuming page's own scripts can see, and these names are ours, not theirs.
//
// Each handler bails out when its markup is absent, so the same bundle serves every
// combination of rendered controls. A handler that has to run before the first paint,
// or before the app's own scripts, goes in `uniformenHeadScript` instead.
const UNIFORMEN_SCRIPTS = `(() => {
${panelToggle.toString().trim()}
${retargetEnvironmentLinks.toString().trim()}
${localeHandlers.toString().trim()}
panelToggle("[data-uniformen-app-switcher-toggle]", "uniformen-app-switcher-panel");
panelToggle("[data-uniformen-env-switcher-toggle]", "uniformen-environment-switcher-panel", retargetEnvironmentLinks);
panelToggle("[data-uniformen-user-menu-toggle]", "uniformen-user-menu-panel");
panelToggle("[data-uniformen-locale-switcher-toggle]", "uniformen-locale-switcher-panel");
localeHandlers();
})();`;

export const uniformenScriptsHash = await sha256Source(UNIFORMEN_SCRIPTS);

/**
 * Render the uniformen scripts as a single inline `<script>`.
 */
export const renderUniformenScripts = () => {
  return `<script>${UNIFORMEN_SCRIPTS}</script>` as const;
};
