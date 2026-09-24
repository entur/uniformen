/// <reference lib="dom" />

/**
 * Makes one top bar panel open and close. The toggle button's `aria-expanded` holds
 * the open state, and CSS shows the panel from it. A click on the toggle opens or
 * closes the panel. A click outside, Escape, or moving focus out of the panel closes it.
 *
 * Keyboard:
 *
 *  - Opening moves focus to the first item. If the panel contains only the language
 *    options, it moves focus to the checked language instead.
 *  - Up and Down move through the items and wrap around. Home and End go to the
 *    first and last item.
 *  - Escape closes the panel and moves focus back to the toggle.
 *  - Tab out of the panel closes it, so no open panel is left behind the focus.
 *
 * A `role="menu"` group in the panel is a single tab stop. This function moves that
 * tab stop to the option that has focus (a roving `tabindex`).
 *
 * Does nothing if the toggle or the panel is not in the page. `beforeOpen` runs
 * while the panel is still hidden, so it can update the panel first. This function
 * is sent to the browser as source code, so `beforeOpen` can only use its argument
 * and browser globals.
 */
export default function panelToggle(
  toggleSelector: string,
  panelId: string,
  beforeOpen?: (panel: HTMLElement) => void,
) {
  const toggle = document.querySelector(toggleSelector);
  if (!(toggle instanceof HTMLElement)) return;

  const panel = document.getElementById(panelId);
  if (!panel) return;

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  // Returns the links and enabled buttons in the panel, in document order. It is
  // called on every keypress because the panel's contents can change after load.
  const items = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    for (const node of panel.querySelectorAll("a[href], button:not([disabled])")) {
      if (node instanceof HTMLElement) found.push(node);
    }
    return found;
  };

  const checkedItem = (list: HTMLElement[]) =>
    list.filter((item) => item.getAttribute("aria-checked") === "true")[0];

  // The radio group, if the panel has one. Its items share one tab stop. The other
  // items in the panel each keep their own tab stop.
  const group = panel.querySelector('[role="menu"]');
  const groupItems = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    for (const node of group?.querySelectorAll('[role="menuitemradio"]') ?? []) {
      if (node instanceof HTMLElement) found.push(node);
    }
    return found;
  };

  /**
   * Sets `tabindex="0"` on `active` and `-1` on the other group items. Without a
   * valid `active`, it uses the checked item, or the first item.
   */
  const rove = (active?: HTMLElement) => {
    const list = groupItems();
    const stop = active && list.indexOf(active) !== -1 ? active : (checkedItem(list) ?? list[0]);
    for (const item of list) item.setAttribute("tabindex", item === stop ? "0" : "-1");
  };
  // Set the tabindex again here in case the server-rendered markup is wrong.
  if (group) rove();

  // Move the tab stop to the group item that gets focus, whether by opening, arrow
  // keys or a click. Focus outside the group does not change the tab stop.
  group?.addEventListener("focusin", (event) => {
    if (event.target instanceof HTMLElement) rove(event.target);
  });

  const close = () => toggle.setAttribute("aria-expanded", "false");

  toggle.addEventListener("click", () => {
    if (isOpen()) {
      close();
      return;
    }
    beforeOpen?.(panel);
    toggle.setAttribute("aria-expanded", "true");
    // CSS shows the panel from `aria-expanded`, so its items can only get focus now.
    // If the panel contains only the radio group, focus the checked option. If it
    // also has other items, like the user menu, focus the first item.
    const list = items();
    const start = groupItems().length === list.length ? (checkedItem(list) ?? list[0]) : list[0];
    start?.focus();
  });

  document.addEventListener("click", (event) => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (toggle.contains(target) || panel.contains(target)) return;
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      close();
      toggle.focus();
    }
  });

  panel.addEventListener("keydown", (event) => {
    const list = items();
    if (!list.length) return;
    const active = document.activeElement;
    const from = active instanceof HTMLElement ? list.indexOf(active) : -1;

    // The arrow keys wrap around. When no item has focus, Down goes to the first
    // item and Up goes to the last.
    let to: number;
    if (event.key === "ArrowDown") to = from === -1 ? 0 : (from + 1) % list.length;
    else if (event.key === "ArrowUp") to = from <= 0 ? list.length - 1 : from - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = list.length - 1;
    else return;

    // Only prevent the default for the keys above. Other keys, like page scrolling,
    // keep working.
    event.preventDefault();
    const next = list[to];
    if (!next) return;
    next.focus();
  });

  // Close the panel when focus moves out of it, for example with Tab. Focus that
  // moves inside the panel or to the toggle does not close it. A click on the panel
  // heading or leaving the window has no `relatedTarget`. The panel stays open then,
  // so a click inside the panel does not close it.
  panel.addEventListener("focusout", (event) => {
    if (!isOpen()) return;
    const next = event.relatedTarget;
    if (!(next instanceof Node)) return;
    if (panel.contains(next) || toggle.contains(next)) return;
    close();
  });
}
