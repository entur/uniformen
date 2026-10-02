/// <reference lib="dom" />

/**
 * Dispatches `uniformen:ai-agent` on `window` when the AI agent button is clicked,
 * so the consuming app can open its agent.
 */
export default function aiAgentHandlers() {
  // Wait for clicks anywhere on the page.
  document.addEventListener("click", (event) => {
    // `event.target` is the element that was clicked. It might be the icon inside the button.                                                           
    const target = event.target;
    // TypeScript doesn't know `target` is an element, so we check first.
    if (!(target instanceof Element)) return;

    // Find the drawer and the button by their names.
    const drawer = document.getElementById("uniformen-chat-drawer");
    const button = document.querySelector("[data-uniformen-ai-agent-toggle]");
    // If they aren't in the page (aiAgent is off), do nothing.
    if (!drawer || !button) return;

    const locationName = drawer.querySelector<HTMLElement>(".uniformen-chat-drawer__location-name");
    // "/turnover/settlements" becomes "turnover, settlements". Empty parts are
    // removed, so "/" and a trailing "/" give no extra commas.
    const location = window.location.pathname.split("/").filter(Boolean).join(", ");
    // When the path is empty, keep the server-rendered "unknown" text.
    if (locationName && location) locationName.textContent = location;
    // `closest` checks the clicked element and its parents. So a click on the icon                                                                     
    // inside the button still counts as a click on the button.
    if (target.closest("[data-uniformen-ai-agent-toggle]")) {
      drawer.hidden = !drawer.hidden; // flip: hidden -> shown, shown -> hidden                                                                       
    } else if (target.closest("[data-uniformen-chat-drawer-close]")) {
      drawer.hidden = true;
    } else {
      return;
    }
    button.setAttribute("aria-expanded", drawer.hidden ? "false" : "true");
  });
}