/// <reference lib="dom" />

/**
 * One panel in the top bar: a toggle button whose `aria-expanded` is the open
 * state, and the panel that attribute shows. Opening on a click, closing on a
 * second click, on a click outside and on Escape is the same behaviour for every
 * panel in the bar, so this is serialized once and called once per panel — the
 * list of them is in `uniformenScripts`.
 *
 * One keyboard model, for every panel:
 *
 *  - opening moves focus into the panel — onto the checked item where there is one,
 *    the first otherwise, so a language menu opens on the language you are in;
 *  - Up/Down step through the panel's items and wrap, Home/End jump to the ends;
 *  - Escape closes and hands focus back to the chip;
 *  - Tabbing out closes: an open panel behind the focus is a panel the user has no
 *    way of knowing is still there.
 *
 * A `role="menu"` group inside the panel — the language options — is one tab stop,
 * which is what that role promises. Keeping that stop on whichever option has the
 * focus is the roving `tabindex` written here.
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
  const toggle = document.querySelector(toggleSelector);
  if (!(toggle instanceof HTMLElement)) return;

  const panel = document.getElementById(panelId);
  if (!panel) return;

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  // Everything the user can land on, in document order: links and buttons. Read per
  // keypress rather than once, since a panel's contents are the app's to change.
  const items = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    for (const node of panel.querySelectorAll("a[href], button:not([disabled])")) {
      if (node instanceof HTMLElement) found.push(node);
    }
    return found;
  };

  const checkedItem = (list: HTMLElement[]) =>
    list.filter((item) => item.getAttribute("aria-checked") === "true")[0];

  // The radio group, if this panel has one. Its items are the ones the roving
  // tabindex applies to; the rest of the panel keeps a tab stop each.
  const group = panel.querySelector('[role="menu"]');
  const groupItems = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    for (const node of group?.querySelectorAll('[role="menuitemradio"]') ?? []) {
      if (node instanceof HTMLElement) found.push(node);
    }
    return found;
  };

  /** Give the group a single tab stop, on `active`. */
  const rove = (active?: HTMLElement) => {
    const list = groupItems();
    const stop = active && list.indexOf(active) !== -1 ? active : (checkedItem(list) ?? list[0]);
    for (const item of list) item.setAttribute("tabindex", item === stop ? "0" : "-1");
  };
  // The markup arrives roved, on the checked option. Re-asserted rather than
  // trusted: where it agrees these writes change nothing, and where it does not the
  // group is one tab stop from here on.
  if (group) rove();

  // The stop follows the focus into the group however it got there: opening, the
  // arrows, a click. Focus landing outside the group never reaches this, so leaving
  // it leaves its stop where it was.
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
    // The panel is shown by CSS off the attribute just written, so this is the first
    // moment there is anything focusable to move to.
    //
    // A panel that is nothing but the radio group — the bar's language chip — opens
    // on the checked option, which is where the user already is. A menu that merely
    // contains one opens at the top like any other list: someone reaching for the
    // user menu is not reaching for the language.
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

    // Wrapping, and from nowhere in particular the ends are the two starting points.
    let to: number;
    if (event.key === "ArrowDown") to = from === -1 ? 0 : (from + 1) % list.length;
    else if (event.key === "ArrowUp") to = from <= 0 ? list.length - 1 : from - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = list.length - 1;
    else return;

    // Only once a key of ours has been recognised: everything else, the page's own
    // scrolling included, is left alone.
    event.preventDefault();
    const next = list[to];
    if (!next) return;
    next.focus();
  });

  // Tab (or anything else) taking focus out of the panel closes it. Focus moving
  // within the panel, or back onto the chip, is not leaving — and neither is focus
  // going nowhere at all: clicking the panel's own heading, or leaving the window,
  // has no `relatedTarget`, and closing on that would pull the panel out from under
  // the click. Tab always names where it went, which is the case this is for.
  panel.addEventListener("focusout", (event) => {
    if (!isOpen()) return;
    const next = event.relatedTarget;
    if (!(next instanceof Node)) return;
    if (panel.contains(next) || toggle.contains(next)) return;
    close();
  });
}
