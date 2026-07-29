import sidebarHandlers from "../components/sidebarHandlers.ts";
import { sha256Source } from "./sha256.ts";

// Two things belong here rather than in `uniformenScripts` at the end of the body:
// state the first paint depends on, and anything that has to be listening before the
// app's own scripts run. The sidebar is both. Everything else waits for the body.
const UNIFORMEN_HEAD_SCRIPT = `(${sidebarHandlers.toString().trim()})();`;

export const uniformenHeadScriptHash = await sha256Source(UNIFORMEN_HEAD_SCRIPT);

/**
 * Render the head script as a single inline `<script>`. Belongs in `<head>`:
 * deferring it to the body means the sidebar paints expanded and then jumps, and an
 * app that writes the state attribute early has that write go unnoticed.
 */
export const renderUniformenHeadScript = () => {
  return `<script>${UNIFORMEN_HEAD_SCRIPT}</script>` as const;
};
