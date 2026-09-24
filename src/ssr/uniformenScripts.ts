import localeHandlers from "../components/localeHandlers.ts";
import panelToggle from "../components/panelToggle.ts";
import retargetEnvironmentLinks from "../components/retargetEnvironmentLinks.ts";
import { sha256Source } from "./sha256.ts";

// `toString()` on a function declaration returns source that declares the function,
// so the script can call the handlers by name below. There is one `panelToggle` call
// per panel in the top bar.
//
// The code is wrapped in an IIFE so the function names do not become globals that
// the consuming page's scripts can see.
//
// Each handler does nothing when its markup is missing, so the same script works for
// every combination of controls. Code that must run before the first paint goes in
// `uniformenHeadScript`.
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
 * Renders the uniformen scripts as one inline `<script>`.
 */
export const renderUniformenScripts = () => {
  return `<script>${UNIFORMEN_SCRIPTS}</script>` as const;
};
