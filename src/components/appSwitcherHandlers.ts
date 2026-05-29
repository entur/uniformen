/// <reference lib="dom" />

export default function appSwitcherHandlers() {
  const toggle = document.querySelector("[data-uniformen-app-switcher-toggle]");
  if (!(toggle instanceof HTMLElement)) return;

  const panel = document.getElementById("app-switcher-panel");
  if (!panel) return;

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  toggle.addEventListener("click", () => {
    toggle.setAttribute("aria-expanded", isOpen() ? "false" : "true");
  });

  document.addEventListener("click", (event) => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (toggle.contains(target) || panel.contains(target)) return;
    toggle.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });

  // TODO focus the first item in the list when opening the app switcher
  // TODO on click handler for adding an app to favorites
  // TODO on click handler for removing an app from favorites
}
