import appSwitcherHandlers from "../components/appSwitcherHandlers.ts";
import sidebarToggleHandlers from "../components/sidebarToggleHandlers.ts";
import { sha256Source } from "./sha256.ts";

// Each handler is self-contained and bails out when its markup is absent, so the
// same bundle serves every combination of rendered controls.
const UNIFORMEN_SCRIPTS = [appSwitcherHandlers, sidebarToggleHandlers]
  .map((handler) => `(${handler.toString().trim()})();`)
  .join("");

export const uniformenScriptsHash = await sha256Source(UNIFORMEN_SCRIPTS);

/**
 * Render the uniformen scripts as a single inline `<script>`.
 **/
export const renderUniformenScripts = () => {
  return `<script>${UNIFORMEN_SCRIPTS}</script>` as const;
};
