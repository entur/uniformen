import appSwitcherHandlers from "../components/appSwitcherHandlers.ts";
import environmentSwitcherHandlers from "../components/environmentSwitcherHandlers.ts";
import { sha256Source } from "./sha256.ts";

// Each handler is self-contained and bails out when its markup is absent, so the
// same bundle serves every combination of rendered controls. A handler that has to
// run before the first paint, or before the app's own scripts, goes in
// `uniformenHeadScript` instead.
const UNIFORMEN_SCRIPTS = [appSwitcherHandlers, environmentSwitcherHandlers]
  .map((handler) => `(${handler.toString().trim()})();`)
  .join("");

export const uniformenScriptsHash = await sha256Source(UNIFORMEN_SCRIPTS);

/**
 * Render the uniformen scripts as a single inline `<script>`.
 */
export const renderUniformenScripts = () => {
  return `<script>${UNIFORMEN_SCRIPTS}</script>` as const;
};
