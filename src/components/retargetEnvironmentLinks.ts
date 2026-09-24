/// <reference lib="dom" />

/**
 * Points the environment switcher links at the page the user is on. The server
 * renders the links with only the host, because it does not know the current page.
 * This adds the current path and hash, so the user lands on the same page in the
 * other environment. Call it each time the panel opens, because in a client-routed
 * app the path changes without the header being rendered again.
 *
 * The query string is dropped. It holds ids and filters from the current
 * environment, and a dev id used in production can find nothing, or a wrong record.
 *
 * Only the origin is kept from the current href, so opening the panel again
 * replaces the old path instead of adding to it.
 */
export default function retargetEnvironmentLinks(panel: HTMLElement) {
  const { pathname, hash } = window.location;
  for (const link of panel.querySelectorAll("a[data-uniformen-env-switcher-link]")) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    link.href = `${new URL(link.href).origin}${pathname}${hash}`;
  }
}
