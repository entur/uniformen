import appSwitcherHandlers from "../components/appSwitcherHandlers.ts";
import { sha256Source } from "./sha256.ts";

const UNIFORMEN_SCRIPTS = `(${appSwitcherHandlers.toString().trim()})();`;

export const uniformenScriptsHash = await sha256Source(UNIFORMEN_SCRIPTS);

/**
 * Render the uniformen scripts as a single inline `<script>`.
 **/
export const renderUniformenScripts = () => {
  return `<script>${UNIFORMEN_SCRIPTS}</script>` as const;
};
