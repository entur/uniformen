/// <reference lib="dom" />

/**
 * Places the notifications panel each time it opens, and again when the window
 * changes size while it is open. If there is room, the panel's left edge goes under
 * the bell button's left edge and the panel extends to the right. Otherwise the
 * stylesheet's position is used, which puts the right edge of the panel at the
 * right end of the bar.
 *
 * This function is sent to the browser as source code, so it can only use browser
 * globals. It must be called after `panelToggle` for the same panel, so its click
 * handler runs after the panel is shown and can be measured.
 */
export default function notificationsPanelPlacement() {
  const toggle = document.querySelector("[data-uniformen-notifications-menu-toggle]");
  const panel = document.getElementById("uniformen-notifications-menu-panel");
  const surface = panel?.querySelector(".uniformen-notifications-menu__surface");
  if (!(toggle instanceof HTMLElement) || !panel || !surface) return;

  const place = () => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    const bar = panel.offsetParent;
    if (!bar) return;

    // Remove the old values first, so the panel is measured at the stylesheet's
    // position. The visible part of the panel is the surface. The panel around it
    // has a transparent left padding.
    panel.style.removeProperty("left");
    panel.style.removeProperty("right");
    const panelBox = panel.getBoundingClientRect();
    const surfaceBox = surface.getBoundingClientRect();
    const bellLeft = toggle.getBoundingClientRect().left;
    if (bellLeft + surfaceBox.width > panelBox.right) return;

    const padding = surfaceBox.left - panelBox.left;
    panel.style.setProperty("left", `${bellLeft - bar.getBoundingClientRect().left - padding}px`);
    panel.style.setProperty("right", "auto");
  };

  toggle.addEventListener("click", place);
  window.addEventListener("resize", place);
}
