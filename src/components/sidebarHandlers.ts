/// <reference lib="dom" />

/**
 * The sidebar's state is `data-uniformen-sidebar` on `<html>`, and that is the
 * only place it lives. Uniformen renders the collapse button; the consuming app
 * renders the sidebar. Both drive the same attribute:
 *
 *   // collapse from anywhere in the app — a close button, a shortcut, a route change
 *   document.documentElement.dataset.uniformenSidebar = "collapsed";
 *
 *   // and style off it, no JavaScript state required
 *   :root[data-uniformen-sidebar="collapsed"] .my-sidebar { width: 0; visibility: hidden }
 *
 * Runs from the document head, for two reasons. The restored state has to be what
 * paints, rather than a correction applied after it. And the observer has to be
 * watching before any app script can write the attribute: a write it did not see
 * would be read as the starting state, so it would be neither announced nor
 * persisted.
 *
 * Everything else is derived here. Whoever writes the attribute — the button or the
 * app — comes through the one observer below, which mirrors `aria-expanded` onto the
 * button (a11y can't be done in CSS), persists the preference, and announces the
 * change for apps that want to react in script:
 *
 *   window.addEventListener("uniformen:sidebar", (e) => setCollapsed(e.detail.collapsed));
 *
 * The button is parsed long after this runs, so clicks are delegated from `document`
 * and the button is looked up per change. Nothing here needs it to exist: an app with
 * only its own control still gets persistence and the event.
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

  // The user's stored preference wins. Without one, an app that server-rendered the
  // attribute keeps the state it rendered — that is how an app picks a default other
  // than expanded, or restores a preference it holds server-side. Failing both,
  // expanded, so nothing downstream has to handle the attribute being absent.
  //
  // Storage access throws in some privacy modes; falling through to the app's own
  // value is a fine answer there, so swallow it.
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("uniformen:sidebar");
  } catch {}
  if (known(stored)) write(stored === "collapsed");
  else if (!known(root.getAttribute("data-uniformen-sidebar"))) write(false);

  // The last state published to the rest of the page. Also what a bad write is
  // reverted to, so the attribute can't be left holding a value nothing agrees on.
  let published = isCollapsed();

  new MutationObserver(() => {
    const value = root.getAttribute("data-uniformen-sidebar");
    if (!known(value)) return write(published);
    const collapsed = value === "collapsed";
    // Re-writing the state it already holds is not a change worth announcing.
    if (collapsed === published) return;
    published = collapsed;

    markButton(collapsed);
    try {
      localStorage.setItem("uniformen:sidebar", value);
    } catch {}
    window.dispatchEvent(new CustomEvent("uniformen:sidebar", { detail: { collapsed } }));
  }).observe(root, { attributeFilter: ["data-uniformen-sidebar"] });

  // Writing the attribute is the whole click handler: the observer does the rest.
  // Delegated rather than bound to the button, which does not exist yet.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-uniformen-sidebar-toggle]")) {
      write(!isCollapsed());
    }
  });

  // The button ships `aria-expanded="true"`: the server can't know the state, and
  // unlike the chevron it can't be derived in CSS. Correct it once it exists.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => markButton(published));
  } else {
    markButton(published);
  }
}
