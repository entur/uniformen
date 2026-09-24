/// <reference lib="dom" />

/**
 * Manages the sidebar state. The state is stored only in `data-uniformen-sidebar`
 * on `<html>`. Uniformen renders the collapse button and the consuming app renders
 * the sidebar. Both can change the attribute:
 *
 *   // Collapse from anywhere in the app, for example a close button or a route change.
 *   document.documentElement.dataset.uniformenSidebar = "collapsed";
 *
 *   // Style the sidebar from the attribute. No JavaScript state is needed.
 *   :root[data-uniformen-sidebar="collapsed"] .my-sidebar { width: 0; visibility: hidden }
 *
 * This must run in the document head, for two reasons. The saved state must be set
 * before the first paint. And the observer must run before any app script changes
 * the attribute. Otherwise it would treat that change as the starting state, and
 * would not save or announce it.
 *
 * Every change to the attribute, from the button or from the app, goes through the
 * observer below. It sets `aria-expanded` on the button, because CSS cannot do
 * that. It also saves the state and dispatches an event for apps that want it:
 *
 *   window.addEventListener("uniformen:sidebar", (e) => setCollapsed(e.detail.collapsed));
 *
 * The button is parsed after this runs, so clicks are handled on `document` and the
 * button is looked up on each change. The button is optional. An app with only its
 * own control still gets the saved state and the event.
 */
export default function sidebarHandlers() {
  const root = document.documentElement;
  const known = (value: string | null) => value === "collapsed" || value === "expanded";
  const isCollapsed = () => root.getAttribute("data-uniformen-sidebar") === "collapsed";
  const write = (collapsed: boolean) =>
    root.setAttribute("data-uniformen-sidebar", collapsed ? "collapsed" : "expanded");
  const markButton = (collapsed: boolean) =>
    document
      .querySelector("[data-uniformen-sidebar-toggle]")
      ?.setAttribute("aria-expanded", collapsed ? "false" : "true");

  // Use the saved preference first. Without one, keep the value the app rendered on
  // the server, so the app can choose its own default. If neither is valid, use
  // expanded, so the attribute is always set.
  //
  // localStorage throws in some privacy modes. Ignore the error and use the app's
  // value instead.
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("uniformen:sidebar");
  } catch {}
  if (known(stored)) write(stored === "collapsed");
  else if (!known(root.getAttribute("data-uniformen-sidebar"))) write(false);

  // The last state that was announced. An invalid value in the attribute is replaced
  // with this, so the attribute always holds a valid state.
  let published = isCollapsed();

  new MutationObserver(() => {
    const value = root.getAttribute("data-uniformen-sidebar");
    if (!known(value)) return write(published);
    const collapsed = value === "collapsed";
    // Do nothing when the attribute is set to the state it already has.
    if (collapsed === published) return;
    published = collapsed;

    markButton(collapsed);
    try {
      localStorage.setItem("uniformen:sidebar", value);
    } catch {}
    window.dispatchEvent(new CustomEvent("uniformen:sidebar", { detail: { collapsed } }));
  }).observe(root, { attributeFilter: ["data-uniformen-sidebar"] });

  // The click handler only writes the attribute, and the observer does the rest. It
  // listens on `document` because the button does not exist yet.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-uniformen-sidebar-toggle]")) {
      write(!isCollapsed());
    }
  });

  // The server renders the button with `aria-expanded="true"` because it does not
  // know the state. CSS cannot set this attribute, so fix it once the button exists.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => markButton(published));
  } else {
    markButton(published);
  }
}
