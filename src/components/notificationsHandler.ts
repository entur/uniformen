/// <reference lib="dom" />

/**
 * Tells uniformen to delete a notification when the user clicks it.
 *
 * The click normally follows the link straight away, so the next page could load
 * before the delete is done. The handler waits for uniformen to answer before it
 * follows the link. It stops waiting after a short time, so the link still works
 * when the server is slow.
 */
export default function notificationsHandler() {
  /** How long to wait for uniformen before following the link anyway. */
  const WAIT_FOR_DELETE_MS = 1000;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const item = target.closest("[data-uniformen-notification-token]");
    if (!item) return;
    const token = item.getAttribute("data-uniformen-notification-token");
    if (!token) return;

    const list = item.closest("[data-uniformen-notifications-url]");
    if (!list) return;
    const proxyUrl = list.getAttribute("data-uniformen-notifications-url");
    if (!proxyUrl) return;

    // `keepalive` lets the request finish even when we do follow the link first.
    const deleting = fetch(proxyUrl, {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);

    // Leave the click alone when it is not a plain left click on a link, for example
    // a middle click or ctrl-click, which opens a new tab and leaves this page as it
    // is. Another handler may also have stopped the navigation. The delete is already sent either way.
    const isPlainClick =
      event instanceof MouseEvent &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (!(item instanceof HTMLAnchorElement) || !isPlainClick || event.defaultPrevented) return;

    const href = item.href;
    event.preventDefault();

    const wait = new Promise((resolve) => setTimeout(resolve, WAIT_FOR_DELETE_MS));
    void Promise.race([deleting, wait]).then(() => location.assign(href));
  });
}
