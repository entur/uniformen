import { PORTAL_APPLICATION_IDS, portalApplicationName } from "../components/portalApplications";
import { environment as runningEnvironment, type Environment } from "../config";
import { LOCALE_NAMES, LOCALES } from "../types";
import type { PreviewQuery } from "./preview";

/**
 * The page's own URL rebuilt from the query as it validated: the canonical spelling
 * of what is on screen, so unknown params, a repeated key and a `sidebar=false`
 * that only says the default out loud all drop out of the copyable link.
 *
 * Held to the same production rule as the knobs it echoes — a prod URL carrying a
 * `debugUser` renders nobody, so printing it would hand out a link that lies.
 */
export function previewUrl(
  query: PreviewQuery,
  environment: Environment = runningEnvironment,
): string {
  const params = new URLSearchParams();
  if (query.app) params.set("app", query.app);
  if (query.sidebar === "true") params.set("sidebar", "true");
  if (query.simple === "true") params.set("simple", "true");
  if (query.contrast === "true") params.set("contrast", "true");
  if (query.loginUrl) params.set("loginUrl", query.loginUrl);
  if (query.logoutUrl) params.set("logoutUrl", query.logoutUrl);
  params.set("locale", query.locale);
  for (const locale of query.availableLocales ?? []) params.append("availableLocales", locale);
  if (environment !== "production") {
    if (query.debugUser) params.set("debugUser", query.debugUser);
    if (query.debugEmail) params.set("debugEmail", query.debugEmail);
    if (query.debugEnturUser === "true") params.set("debugEnturUser", "true");
  }
  return `/?${params}`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children?: unknown }) {
  return (
    <div class="preview-controls__field">
      <span class="preview-controls__label">{label}</span>
      {hint ? <span class="preview-controls__hint">{hint}</span> : null}
      {children}
    </div>
  );
}

const GROUP_TITLES = {
  left: "◀ Venstre i baren",
  right: "Høyre i baren ▶",
  whole: "Hele baren",
} as const;

/**
 * The knobs for one part of the bar, placed where that part is: the two ends at the
 * two ends of the box, with the fields running outside-in like the bar does, and what
 * belongs to neither end below them both.
 *
 * Only ever as true as a centred box can be — an app's sidebar shifts the content area
 * off the bar's own left edge — so it is a hint, not an alignment.
 */
function Group({ where, children }: { where: keyof typeof GROUP_TITLES; children?: unknown }) {
  return (
    <fieldset class={`preview-controls__group preview-controls__group--${where}`}>
      <legend class="preview-controls__group-title">{GROUP_TITLES[where]}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The preview page's knobs as a form, so the parameters can be found by looking at
 * the page instead of by knowing them already.
 *
 * A plain GET form, submitting to the page itself: every control is named after the
 * parameter it sets, so the address bar it produces is the documentation. Nothing is
 * mirrored in JavaScript — the server re-renders, and the controls come back set from
 * the query it validated. A parameter combination the schema rejects gets the same 400
 * a hand-written URL would, which is the contract, not a bug in the form.
 *
 * A change applies itself (see the page's script), so the button is what is left for
 * a keyboard: Enter in a text field needs a form with a submit button in it.
 *
 * A control left empty is dropped on submit rather than sent as `app=` (see the page's
 * script): the empty spellings are rejected values, and a URL is worth more to copy
 * without them.
 *
 * Norwegian whatever `locale` says, like the demo sidebar: that parameter is the
 * language of the chrome being looked at, not of the tool looking at it.
 */
export function PreviewControls({
  query,
  environment = runningEnvironment,
}: {
  query: PreviewQuery;
  environment?: Environment;
}) {
  const url = previewUrl(query, environment);
  return (
    <div class="preview-controls">
      <form class="preview-controls__form" method="get" action="/" data-preview-controls>
        <h1 class="preview-controls__title">Forhåndsvisning av Uniformen</h1>
        <p class="preview-controls__intro">Hver kontroll er en query-parameter.</p>

        <div class="preview-controls__sides">
          <Group where="left">
            <Field label="sidebar" hint="Knappen ytterst til venstre.">
              <label class="preview-controls__check">
                <input
                  type="checkbox"
                  name="sidebar"
                  value="true"
                  checked={query.sidebar === "true"}
                />
                appen har en sidemeny som kan skjules
              </label>
            </Field>

            <Field label="app" hint="Navnet ved logoen, og hvilken app som er den aktive.">
              <select class="preview-controls__select" name="app">
                <option value="" selected={!query.app}>
                  — ingen —
                </option>
                {PORTAL_APPLICATION_IDS.map((id) => (
                  <option value={id} selected={query.app === id}>
                    {portalApplicationName(id)} ({id})
                  </option>
                ))}
              </select>
            </Field>

            {/* Production renders no chip whatever the URL says, so it gets no control
                claiming otherwise. Beside the app name, hence this end. */}
            {environment === "production" ? null : (
              <Field label="debugEnturUser" hint="Bare forhåndsvisningen — kommer fra tokenet.">
                <label class="preview-controls__check">
                  <input
                    type="checkbox"
                    name="debugEnturUser"
                    value="true"
                    checked={query.debugEnturUser === "true"}
                  />
                  miljømerke og miljøvelger
                </label>
              </Field>
            )}
          </Group>

          <Group where="right">
            {/* Same production rule, same reason: no session behind the name. */}
            {environment === "production" ? null : (
              <Field
                label="debugUser / debugEmail"
                hint="Bare forhåndsvisningen — kommer fra tokenet."
              >
                <label class="preview-controls__check">
                  <span class="preview-controls__name">debugUser</span>
                  <input
                    class="preview-controls__text"
                    type="text"
                    name="debugUser"
                    value={query.debugUser}
                    placeholder="Navn Navnesen"
                    maxlength={120}
                  />
                </label>
                <label class="preview-controls__check">
                  <span class="preview-controls__name">debugEmail</span>
                  <input
                    class="preview-controls__text"
                    type="text"
                    name="debugEmail"
                    value={query.debugEmail}
                    placeholder="navn.navnesen@entur.org"
                    maxlength={120}
                  />
                </label>
              </Field>
            )}

            <Field label="loginUrl" hint="Hvor «Logg inn» peker. Tom gir ingen lenke.">
              <input
                class="preview-controls__text"
                type="text"
                name="loginUrl"
                value={query.loginUrl}
                placeholder="/auth/login"
                maxlength={512}
              />
            </Field>

            <Field label="logoutUrl" hint="Hvor «Logg ut» peker. Tom gir ingen rad.">
              <input
                class="preview-controls__text"
                type="text"
                name="logoutUrl"
                value={query.logoutUrl}
                placeholder="/auth/logout"
                maxlength={512}
              />
            </Field>

            <Field
              label="availableLocales"
              hint="Språkene appen selv tilbyr, som velger i brukermenyen. Ingen gir ingen velger; språket under er alltid med."
            >
              {LOCALES.map((locale) =>
                locale === query.locale ? (
                  /* Locked on: a list that leaves out the language being rendered is a
                     400, so the box that would produce one can't be unticked. Disabled
                     submits nothing, hence the hidden twin in its place. It carries the
                     language the page was rendered in, so the way out is where a locale
                     pick is caught up with and where a twin left alone is dropped (see
                     the page's script). */
                  <label class="preview-controls__check">
                    <input type="checkbox" checked disabled />
                    <input
                      type="hidden"
                      name="availableLocales"
                      value={locale}
                      data-preview-locale
                    />
                    {locale}
                  </label>
                ) : (
                  <label class="preview-controls__check">
                    <input
                      type="checkbox"
                      name="availableLocales"
                      value={locale}
                      checked={query.availableLocales?.includes(locale)}
                    />
                    {locale}
                  </label>
                ),
              )}
            </Field>
          </Group>
        </div>

        {/* Neither end: one hides controls at both, the other is the language of
            everything the page renders, footer included. */}
        <Group where="whole">
          <Field label="simple" hint="Skjuler app-velger, varsler og sidemeny-knappen.">
            <label class="preview-controls__check">
              <input type="checkbox" name="simple" value="true" checked={query.simple === "true"} />
              appen har en enkel header og footer
            </label>
          </Field>

          <Field label="contrast" hint="Kontrastpaletten fra designsystemet — for mørke sider.">
            <label class="preview-controls__check">
              <input
                type="checkbox"
                name="contrast"
                value="true"
                checked={query.contrast === "true"}
              />
              appen har en mørk side bak headeren
            </label>
          </Field>

          <Field label="locale" hint="Språket headeren og footeren skrives på.">
            <div class="preview-controls__row">
              {LOCALES.map((locale) => (
                <label class="preview-controls__check">
                  <input
                    type="radio"
                    name="locale"
                    value={locale}
                    checked={query.locale === locale}
                  />
                  {locale} — {LOCALE_NAMES[locale]}
                </label>
              ))}
            </div>
          </Field>
        </Group>

        <div class="preview-controls__actions">
          <button class="preview-controls__submit" type="submit">
            Bruk
          </button>
          <a class="preview-controls__reset" href="/">
            Nullstill
          </a>
        </div>
      </form>

      {/* Outside the form: a submit button here would apply the pending edits, and
          what this copies is the URL on screen. */}
      <div class="preview-controls__url">
        <code class="preview-controls__url-text" data-preview-url>
          {url}
        </code>
        <button class="preview-controls__copy" type="button" data-preview-copy>
          Kopier lenke
        </button>
      </div>
    </div>
  );
}
