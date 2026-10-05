/// <reference lib="dom" />

/**
 * Dispatches `uniformen:ai-agent` on `window` when the AI agent button is clicked,
 * so the consuming app can open its agent.
 */
export default function aiAgentHandlers() {
  // Moves the drawer so its top is at the bottom edge of the bar. When the user has
  // scrolled the bar out of view, the drawer's top is at the top of the window.
  // In the same way, the drawer's bottom stops at the top edge of the footer, so
  // the drawer never covers the footer.
  function placeDrawer() {
    const drawer = document.getElementById("uniformen-chat-drawer");
    const bar = document.getElementById("top-navigation");
    if (!drawer || !bar || drawer.hidden) return;
    drawer.style.top = `${Math.max(0, bar.getBoundingClientRect().bottom)}px`;
    // The app may not show the footer. Then the drawer goes to the bottom of the window.
    const footer = document.getElementById("footer");
    const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
    drawer.style.bottom = `${Math.max(0, window.innerHeight - footerTop)}px`;
  }
  // `passive` tells the browser that the listener never stops the scroll, so scrolling stays smooth.
  window.addEventListener("scroll", placeDrawer, { passive: true });
  window.addEventListener("resize", placeDrawer);

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
    // Hide the example questions when the user clicks one of them, or sends a
    // question of their own. The send button only counts when the field has text.
    // TODO: Show the example questions again when the user starts a new chat.
    const example = target.closest<HTMLElement>("[data-uniformen-chat-example]");
    const textarea = drawer.querySelector<HTMLTextAreaElement>(".uniformen-chat-textarea");
    const sent = target.closest("[data-uniformen-chat-send]") && textarea?.value.trim();
    if (example || sent) {
      const examples = drawer.querySelector<HTMLElement>("[data-uniformen-chat-examples]");
      if (examples) examples.hidden = true;
    }
    // TODO: Send the question to the agent instead of putting it in the field.
    if (example && textarea) {
      textarea.value = example.textContent ?? "";
      textarea.focus();
    }
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
    // The page may have scrolled while the drawer was closed.
    placeDrawer();
  });
}
