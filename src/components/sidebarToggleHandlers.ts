/// <reference lib="dom" />

/**
 * The top bar owns the sidebar toggle button, but not the sidebar. Flip
 * `aria-expanded` and announce the new state on `window`; the consuming app
 * listens and collapses its own side navigation:
 *
 *   window.addEventListener("uniformen:toggle-sidebar", (e) => {
 *     setCollapsed(e.detail.collapsed);
 *   });
 */
export default function sidebarToggleHandlers() {
  const toggle = document.querySelector("[data-uniformen-sidebar-toggle]");
  if (!(toggle instanceof HTMLElement)) return;

  toggle.addEventListener("click", () => {
    const collapsed = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    window.dispatchEvent(new CustomEvent("uniformen:toggle-sidebar", { detail: { collapsed } }));
  });
}
