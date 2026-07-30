/// <reference lib="dom" />

/**
 * The environment switcher's links, pointed at the page the user is on.
 *
 * The rendered hrefs are bare hosts, because the server has no idea which page of
 * the consuming app the user is on. The point of the switcher is landing on that
 * same page in the other environment, so the path is grafted on here, from the only
 * place that knows it. Redone on every open rather than once at load: in a
 * client-routed app the location changes without the header re-rendering.
 *
 * The query string is dropped: it names rows, filters and ids from the environment
 * being left, and none of that resolves to the same thing in the next one — a dev
 * id carried into prod is at best a not-found and at worst some unrelated record.
 * The hash comes along, being an in-page anchor.
 *
 * The origin is read back off the link, so repeated opens keep resolving against
 * the target environment rather than compounding the previous path.
 */
export default function retargetEnvironmentLinks(panel: HTMLElement) {
  const { pathname, hash } = window.location;
  for (const link of panel.querySelectorAll("a[data-uniformen-env-switcher-link]")) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    link.href = `${new URL(link.href).origin}${pathname}${hash}`;
  }
}
