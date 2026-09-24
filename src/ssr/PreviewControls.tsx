import { PORTAL_APPLICATION_IDS, portalApplicationName } from "../components/portalApplications";
import { environment as runningEnvironment, type Environment } from "../config";
import { LOCALE_NAMES, LOCALES } from "../types";
import type { PreviewQuery } from "./preview";

/**
 * Returns the preview page URL built from the validated query. Unknown parameters,
 * repeated keys and default values such as `sidebar=false` are left out, so the link
 * is short and clean.
 *
 * In production the `debug` parameters are left out, because production ignores
 * them and the link would not show what it claims.
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
 * Renders the controls for one part of the bar. The left group is on the left and
 * the right group is on the right, like the parts of the bar they control. Controls
 * for the whole bar are below both.
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
 * Renders a form with one control per query parameter, so a developer can see all
 * parameters on the page.
 *
 * It is a plain GET form that submits to the page itself. Each control has the same
 * name as its parameter. The server renders the page again and sets the controls from
 * the validated query. If the schema rejects a combination, the form gets a 400, the
 * same as a hand-written URL.
 *
 * The page script submits the form on every change and leaves out empty controls.
 * The submit button is still needed, because Enter in a text field only submits a
 * form that has one.
 *
 * The texts are always Norwegian. `locale` only sets the language of the header and
 * footer.
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

            {/* Production never shows the environment chip, so the control is hidden
                there. It is in the left group because the chip is next to the app name. */}
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
            {/* Hidden in production, because production ignores these parameters. */}
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
                  /* The current locale is always checked and cannot be unchecked,
                     because a list without it gets a 400. A disabled checkbox is not
                     submitted, so a hidden input sends the value instead. The page
                     script updates or removes it on submit. */
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

        {/* These parameters affect both ends of the bar, or the whole page. */}
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

      {/* This is outside the form, so the copy button does not submit it. */}
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
