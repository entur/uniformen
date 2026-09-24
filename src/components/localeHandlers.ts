/// <reference lib="dom" />

/**
 * Dispatches a `uniformen:locale` event on `window` when the user picks a language.
 * It does not change the language itself. The header and the app's texts are
 * rendered in one language, so the app must save the choice and load a new page:
 *
 *   window.addEventListener("uniformen:locale", (e) => { persist(e.detail.locale); location.reload() });
 *
 * A click on the language that is already selected sends no event, so the app does
 * not reload for nothing. The listener is on `document`, so it works even when no
 * language options are rendered.
 */
export default function localeHandlers() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest("[data-uniformen-locale]");
    if (!option || option.getAttribute("aria-checked") === "true") return;
    const locale = option.getAttribute("data-uniformen-locale");
    // The options we render always have a locale. Skip other markup, so the app
    // never gets an empty `detail.locale`.
    if (!locale) return;
    window.dispatchEvent(new CustomEvent("uniformen:locale", { detail: { locale } }));
  });
}
