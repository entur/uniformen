/// <reference lib="dom" />

/**
 * A language pick is announced, never applied:
 *
 *   window.addEventListener("uniformen:locale", (e) => { persist(e.detail.locale); location.reload() });
 *
 * The header is rendered in one language on the server and the app's own texts are
 * resolved when its modules load, so nothing but a new document finishes a language
 * change. That makes persistence the app's — it is the one that has to read the
 * choice back on the next render — and re-labelling the bar here would only put a
 * switched header over an unswitched app. Hence no cookie, no storage, no reload
 * and no optimistic re-check from us.
 *
 * Picking the language already rendered is not a change, so it says nothing: the app
 * would reload for nothing.
 *
 * Delegated from `document`, so nothing is bound to markup that may not be rendered
 * and nothing needs tearing down when the app reloads out from under it.
 */
export default function localeHandlers() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest("[data-uniformen-locale]");
    if (!option || option.getAttribute("aria-checked") === "true") return;
    const locale = option.getAttribute("data-uniformen-locale");
    // An option we rendered always carries a tag, so this is the markup being
    // something else. Announcing it would put an empty `detail.locale` in front of
    // an app that has every reason to trust it.
    if (!locale) return;
    window.dispatchEvent(new CustomEvent("uniformen:locale", { detail: { locale } }));
  });
}
