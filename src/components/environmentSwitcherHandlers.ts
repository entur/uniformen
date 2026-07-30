/// <reference lib="dom" />

export default function environmentSwitcherHandlers() {
  const toggle = document.querySelector("[data-uniformen-env-switcher-toggle]");
  if (!(toggle instanceof HTMLElement)) return;

  const panel = document.getElementById("environment-switcher-panel");
  if (!panel) return;

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  // The rendered hrefs are bare hosts, because the server has no idea which page
  // of the consuming app the user is on. The point of the switcher is landing on
  // that same page in the other environment, so the path is grafted on here, from
  // the only place that knows it. Redone on every open rather than once at load:
  // in a client-routed app the location changes without the header re-rendering.
  //
  // The query string is dropped: it names rows, filters and ids from the
  // environment being left, and none of that resolves to the same thing in the
  // next one — a dev id carried into prod is at best a not-found and at worst
  // some unrelated record. The hash comes along, being an in-page anchor.
  //
  // The origin is read back off the link, so repeated opens keep resolving
  // against the target environment rather than compounding the previous path.
  const retargetLinks = () => {
    const { pathname, hash } = window.location;
    for (const link of panel.querySelectorAll("a[data-uniformen-env-switcher-link]")) {
      if (!(link instanceof HTMLAnchorElement)) continue;
      link.href = `${new URL(link.href).origin}${pathname}${hash}`;
    }
  };

  toggle.addEventListener("click", () => {
    if (isOpen()) {
      toggle.setAttribute("aria-expanded", "false");
      return;
    }
    // Before the panel is visible, so a link is never shown pointing somewhere
    // other than where clicking it goes.
    retargetLinks();
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
