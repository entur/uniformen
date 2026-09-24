import sidebarHandlers from "../components/sidebarHandlers.ts";
import { sha256Source } from "./sha256.ts";

// Only code that must run before the first paint, or before the app's own scripts,
// goes in this head script. The sidebar handlers need both. Other scripts go in
// `uniformenScripts`.
const UNIFORMEN_HEAD_SCRIPT = `(${sidebarHandlers.toString().trim()})();`;

export const uniformenHeadScriptHash = await sha256Source(UNIFORMEN_HEAD_SCRIPT);

/**
 * Renders the head script as one inline `<script>`. It must go in `<head>`. In the
 * body, the sidebar would first paint expanded and then jump, and the script would
 * miss changes to the sidebar attribute that the app makes early.
 */
export const renderUniformenHeadScript = () => {
  return `<script>${UNIFORMEN_HEAD_SCRIPT}</script>` as const;
};
