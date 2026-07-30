/// <reference lib="dom" />

/**
 * One panel in the top bar: a toggle button whose `aria-expanded` is the open
 * state, and the panel that attribute shows. Opening on a click, closing on a
 * second click, on a click outside and on Escape is the same behaviour for every
 * panel in the bar, so this is serialized once and called once per panel — the
 * list of them is in `uniformenScripts`.
 *
 * Bails out when either half of the markup is absent, so the same bundle serves
 * every combination of rendered controls.
 *
 * `beforeOpen` is for a panel with something to bring up to date first, and runs
 * while the panel is still hidden. It ships as source alongside the call, so it
 * can only reach what it is handed and what the browser provides.
 */
export default function panelToggle(
  toggleSelector: string,
  panelId: string,
  beforeOpen?: (panel: HTMLElement) => void,
) {
  // TODO focus the first item in the panel when opening it

  const toggle = document.querySelector(toggleSelector);
  if (!(toggle instanceof HTMLElement)) return;

  const panel = document.getElementById(panelId);
  if (!panel) return;

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  toggle.addEventListener("click", () => {
    if (isOpen()) {
      toggle.setAttribute("aria-expanded", "false");
      return;
    }
    beforeOpen?.(panel);
    toggle.setAttribute("aria-expanded", "true");
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
}
