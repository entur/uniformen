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
  if (query.aiAgent === "true") params.set("aiAgent", "true");
  if (query.colorMode === "dark") params.set("colorMode", "dark");
  if (query.loginUrl) params.set("loginUrl", query.loginUrl);
  if (query.logoutUrl) params.set("logoutUrl", query.logoutUrl);
  if (query.hideNotifications === "true") params.set("hideNotifications", "true");
  params.set("locale", query.locale);
  for (const locale of query.availableLocales ?? []) params.append("availableLocales", locale);
  if (environment !== "production") {
    if (query.debugUser) params.set("debugUser", query.debugUser);
    if (query.debugOrganisation) params.set("debugOrganisation", query.debugOrganisation);
    // Leave it out without a user, because the page then ignores it.
    if (query.debugUser && query.debugEnturUser === "true") params.set("debugEnturUser", "true");
    if (query.debugNotifications && query.debugNotifications !== "max") {
      params.set("debugNotifications", query.debugNotifications);
    }
  }
  return `/?${params}`;
}

/** The functions in `@entur/uniformen` that fetch the layout. The page has a tab for each. */
const CODE_EXAMPLES = {
  layout: {
    label: "fetchUniformenLayout",
    module: "@entur/uniformen",
    result: "const layout",
    fetch: "fetchUniformenLayout",
  },
  react: {
    label: "React",
    module: "@entur/uniformen/react",
    result: "const { HeadAssets, Header, Footer, Scripts, csp }",
    fetch: "fetchUniformenComponents",
  },
} as const;

export type CodeExample = keyof typeof CODE_EXAMPLES;

const CODE_EXAMPLE_IDS: CodeExample[] = ["layout", "react"];

/**
 * Returns code that fetches the layout with the `@entur/uniformen` package, with the
 * parameters from the validated query. Like `previewUrl`, it leaves out default values.
 * It always leaves out the `debug` parameters, because the package gets the user from
 * `token`.
 *
 * `environment` is where this preview runs. It is left out in production, because
 * production is the package's default.
 */
export function previewCode(
  query: PreviewQuery,
  example: CodeExample,
  environment: Environment = runningEnvironment,
): string {
  const { module, result, fetch } = CODE_EXAMPLES[example];
  // The values are written with JSON.stringify, so they are valid string literals.
  const params: string[] = [];
  if (query.app) params.push(`app: ${JSON.stringify(query.app)}`);
  params.push(`locale: ${JSON.stringify(query.locale)}`);
  if (query.availableLocales) {
    const list = query.availableLocales.map((locale) => JSON.stringify(locale)).join(", ");
    params.push(`availableLocales: [${list}]`);
  }
  if (query.sidebar === "true") params.push("sidebar: true");
  if (query.loginUrl) params.push(`loginUrl: ${JSON.stringify(query.loginUrl)}`);
  if (query.logoutUrl) params.push(`logoutUrl: ${JSON.stringify(query.logoutUrl)}`);
  if (query.contrast === "true") params.push("contrast: true");
  if (query.simple === "true") params.push("simple: true");
  if (query.aiAgent === "true") params.push("aiAgent: true");
  if (query.hideNotifications === "true") params.push("hideNotifications: true");

  return [
    `import { ${fetch} } from "${module}";`,
    "",
    `${result} = await ${fetch}({`,
    "  token, // the signed-in user's Auth0 access token",
    ...(environment === "production" ? [] : [`  environment: "${environment}",`]),
    "  params: {",
    ...params.map((param) => `    ${param},`),
    "  },",
    "});",
  ].join("\n");
}

/** Who the preview bar is rendered for. */
export type PreviewViewer = "anonymous" | "external" | "entur";

/**
 * Returns who the preview bar is rendered for. `debugEnturUser` only counts together
 * with `debugUser`, because a user who is not signed in cannot be an Entur user.
 * Production always renders the bar for a user who is not signed in.
 */
export function previewViewer(
  { debugUser, debugEnturUser }: Pick<PreviewQuery, "debugUser" | "debugEnturUser">,
  environment: Environment = runningEnvironment,
): PreviewViewer {
  if (environment === "production" || !debugUser) return "anonymous";
  return debugEnturUser === "true" ? "entur" : "external";
}

/** The name the page fills in when a user is picked and the name field is empty. */
export const PREVIEW_DEFAULT_USER = "Navn Navnesen";

const VIEWER_OPTIONS: { value: PreviewViewer; label: string; hint?: string }[] = [
  { value: "anonymous", label: "Ikke innlogget" },
  { value: "external", label: "Innlogget" },
  { value: "entur", label: "Entur-ansatt", hint: "Med miljøvelger" },
];

type NotificationsChoice = "hidden" | "none" | "some" | "max";

const NOTIFICATIONS_OPTIONS: { value: NotificationsChoice; label: string }[] = [
  { value: "max", label: "Mange varsler" },
  { value: "some", label: "Noen varsler" },
  { value: "none", label: "Ingen varsler" },
  { value: "hidden", label: "Ingen varselknapp" },
];

/**
 * Renders one control with a Norwegian label. `param` is the query parameter the
 * control sets, shown in small text for developers. `inactive` says why the control
 * has no effect right now. The control still works, so its value is kept.
 *
 * With `input`, the label is inside the box around the text field or menu, like
 * the text field in the Entur design system. The hint is then below the box.
 */
function Field({
  label,
  param,
  hint,
  inactive,
  wide,
  input,
  children,
}: {
  label: string;
  param?: string;
  hint?: string;
  inactive?: string | false;
  wide?: boolean;
  input?: boolean;
  children?: unknown;
}) {
  const classes = ["preview-controls__field"];
  if (inactive) classes.push("preview-controls__field--inactive");
  if (wide) classes.push("preview-controls__field--wide");
  // Leave out the parameter when it is the same word as the label, as for "App".
  const paramTag =
    param && param.toLowerCase() !== label.toLowerCase() ? (
      <code class="preview-controls__param">{param}</code>
    ) : null;
  return (
    <div class={classes.join(" ")}>
      {input ? (
        <label class="preview-controls__input">
          <span class="preview-controls__input-label">
            {label}
            {paramTag}
          </span>
          {children}
        </label>
      ) : (
        <>
          <div class="preview-controls__head">
            <span class="preview-controls__label">{label}</span>
            {paramTag}
          </div>
          {hint ? <span class="preview-controls__hint">{hint}</span> : null}
          {children}
        </>
      )}
      {input && hint ? <span class="preview-controls__hint">{hint}</span> : null}
      {inactive ? <span class="preview-controls__inactive">{inactive}</span> : null}
    </div>
  );
}

/**
 * Renders a checkbox as a card, with the title and description inside the card. The
 * whole card can be clicked. `inactive` works as in `Field`.
 */
function CheckField({
  label,
  param,
  description,
  inactive,
  name,
  value = "true",
  checked,
}: {
  label: string;
  param?: string;
  description?: string;
  inactive?: string | false;
  name: string;
  value?: string;
  checked: boolean;
}) {
  return (
    <div class={`preview-controls__field${inactive ? " preview-controls__field--inactive" : ""}`}>
      <label class="preview-controls__choice">
        <input type="checkbox" name={name} value={value} checked={checked} />
        <span class="preview-controls__head">
          {label}
          {param ? <code class="preview-controls__param">{param}</code> : null}
        </span>
        {description ? <span class="preview-controls__hint">{description}</span> : null}
      </label>
      {inactive ? <span class="preview-controls__inactive">{inactive}</span> : null}
    </div>
  );
}

/**
 * Renders a checkbox that turns a link parameter on, in a panel with a field for the
 * path when it is on. The page script fills in `defaultPath` when the box is checked
 * and the field is empty, so one click gives a working link.
 */
function LinkField({
  label,
  name,
  value,
  defaultPath,
}: {
  label: string;
  name: "loginUrl" | "logoutUrl";
  value?: string;
  defaultPath: string;
}) {
  return (
    <div class="preview-controls__field">
      <div class="preview-controls__link">
        <label class="preview-controls__choice">
          <input
            type="checkbox"
            name={`${name}On`}
            value="true"
            checked={!!value}
            data-preview-link={name}
          />
          <span class="preview-controls__head">
            {label}
            <code class="preview-controls__param">{name}</code>
          </span>
        </label>
        {value ? (
          <input
            class="preview-controls__path"
            type="text"
            name={name}
            value={value}
            placeholder={defaultPath}
            maxlength={512}
            aria-label={`Sti for ${label}`}
            data-default={defaultPath}
          />
        ) : (
          <input
            type="hidden"
            name={name}
            value={defaultPath}
            disabled
            data-default={defaultPath}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Renders a group of controls. With `hideTitle`, the title is only read by screen
 * readers, for a group whose place on the page already says what it is.
 */
function Section({
  id,
  title,
  hideTitle,
  children,
}: {
  id: string;
  title: string;
  hideTitle?: boolean;
  children?: unknown;
}) {
  return (
    <fieldset class={`preview-controls__section preview-controls__section--${id}`}>
      <legend
        class={hideTitle ? "preview-controls__visually-hidden" : "preview-controls__section-title"}
      >
        {title}
      </legend>
      <div class="preview-controls__fields">{children}</div>
    </fieldset>
  );
}

/**
 * Renders the form that sets the preview's query parameters. The controls are
 * grouped by what a developer wants to see, not by parameter.
 *
 * It is a plain GET form that submits to the page itself. The page script submits it
 * on every change. Some controls do not match one parameter. "Hvem ser på?" sets
 * `debugUser` and `debugEnturUser`, and "Varsler" sets `hideNotifications` and
 * `debugNotifications`. The "Logg inn" and "Logg ut" boxes turn `loginUrl` and
 * `logoutUrl` on and off. These radio buttons and boxes have names the schema does
 * not know, and the page script turns them into the right parameters on submit.
 *
 * The texts are always Norwegian. `locale` only sets the language of the header and
 * footer.
 */
export function PreviewControls({
  query,
  environment = runningEnvironment,
  error,
}: {
  query: PreviewQuery;
  environment?: Environment;
  /** A message about a query the schema rejected. The controls then show the defaults. */
  error?: string;
}) {
  const url = previewUrl(query, environment);
  const production = environment === "production";
  const viewer = previewViewer(query, environment);
  const signedIn = viewer !== "anonymous";
  const simple = query.simple === "true";
  const notifications: NotificationsChoice =
    query.hideNotifications === "true" ? "hidden" : (query.debugNotifications ?? "max");
  // Production has no test notifications, so the only choice there is the button or none.
  const notificationsOptions = production
    ? NOTIFICATIONS_OPTIONS.filter((option) => option.value === "max" || option.value === "hidden")
    : NOTIFICATIONS_OPTIONS;

  // Only the link for the current viewer is shown. The other one is kept in a hidden
  // field, so its value is not lost when the viewer changes.
  const loginField = signedIn ? (
    query.loginUrl ? (
      <input type="hidden" name="loginUrl" value={query.loginUrl} />
    ) : null
  ) : (
    <LinkField label="Logg inn" name="loginUrl" value={query.loginUrl} defaultPath="/auth/login" />
  );
  const logoutField = !signedIn ? (
    query.logoutUrl ? (
      <input type="hidden" name="logoutUrl" value={query.logoutUrl} />
    ) : null
  ) : (
    <LinkField
      label="Logg ut"
      name="logoutUrl"
      value={query.logoutUrl}
      defaultPath="/auth/logout"
    />
  );

  return (
    <div class="preview-controls">
      <form class="preview-controls__form" method="get" action="/" data-preview-controls>
        {/* The boxes for the left and right parts of the bar are on the same sides
            as those parts. The card in the middle has the other
            controls. On narrow screens the stylesheet moves the card below the boxes. */}
        <Section id="left" title="Venstre i baren" hideTitle>
          <Field input label="App" param="app">
            <select class="preview-controls__select" name="app">
              <option value="" selected={!query.app}>
                Ingen app
              </option>
              {PORTAL_APPLICATION_IDS.map((id) => (
                <option value={id} selected={query.app === id}>
                  {portalApplicationName(id)}
                </option>
              ))}
            </select>
          </Field>

          <CheckField
            label="Sidemeny"
            param="sidebar"
            inactive={simple && "Skjult fordi «Enkel side» er på."}
            name="sidebar"
            checked={query.sidebar === "true"}
          />
        </Section>

        <div class="preview-controls__card">
          <h1 class="preview-controls__title">Forhåndsvisning av Uniformen</h1>
          {error ? (
            <p class="preview-controls__error" role="alert">
              Lenken hadde en ugyldig verdi, så siden viser standardvalgene. {error}
            </p>
          ) : null}

          {production ? (
            <Section id="viewer" title="Hvem ser på?">
              <p class="preview-controls__note preview-controls__field--wide">
                I produksjon vises baren alltid for en bruker som ikke er innlogget.
              </p>
              {loginField}
              {logoutField}
            </Section>
          ) : (
            <Section id="viewer" title="Hvem ser på?">
              <div class="preview-controls__field preview-controls__field--wide">
                <div class="preview-controls__choices">
                  {VIEWER_OPTIONS.map((option) => (
                    <label class="preview-controls__choice">
                      <input
                        type="radio"
                        name="viewer"
                        value={option.value}
                        checked={viewer === option.value}
                        data-preview-viewer
                      />
                      {option.label}
                      {option.hint ? (
                        <span class="preview-controls__hint">{option.hint}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
              {/* A disabled fieldset does not submit its fields. The page script enables
                  it and fills in a name when a signed-in user is picked. */}
              <fieldset
                class="preview-controls__person"
                hidden={!signedIn}
                disabled={!signedIn}
                data-preview-person
              >
                <Field input label="Navn">
                  <input
                    class="preview-controls__text"
                    type="text"
                    name="debugUser"
                    value={query.debugUser}
                    placeholder={`f.eks. ${PREVIEW_DEFAULT_USER}`}
                    maxlength={120}
                    data-default={PREVIEW_DEFAULT_USER}
                  />
                </Field>
                <Field input label="Organisasjon">
                  <input
                    class="preview-controls__text"
                    type="text"
                    name="debugOrganisation"
                    value={query.debugOrganisation}
                    placeholder="f.eks. Entur"
                    maxlength={120}
                  />
                </Field>
              </fieldset>
              {loginField}
              {logoutField}
              <input
                type="hidden"
                name="debugEnturUser"
                value="true"
                disabled={viewer !== "entur"}
                data-preview-entur
              />
            </Section>
          )}

          <Section id="page" title="Hele siden">
            <CheckField
              label="Enkel side"
              param="simple"
              description="For innlogging, feilsider og vilkår."
              name="simple"
              checked={simple}
            />

            <CheckField
              label="Kontrast"
              param="contrast"
              name="contrast"
              checked={query.contrast === "true"}
            />

            <CheckField
              label="Mørk modus"
              name="colorMode"
              value="dark"
              checked={query.colorMode === "dark"}
            />
          </Section>

          <div class="preview-controls__actions">
            <button class="preview-controls__submit" type="submit">
              Bruk
            </button>
            <a class="preview-controls__reset" href="/">
              Nullstill
            </a>
          </div>
        </div>

        <Section id="right" title="Høyre i baren" hideTitle>
          <Field label="Språk i baren" param="locale">
            <div class="preview-controls__row">
              {LOCALES.map((locale) => (
                <label class="preview-controls__check">
                  <input
                    type="radio"
                    name="locale"
                    value={locale}
                    checked={query.locale === locale}
                  />
                  {LOCALE_NAMES[locale]}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Språkvelger" param="availableLocales">
            <div class="preview-controls__row">
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
                    {LOCALE_NAMES[locale]}
                  </label>
                ) : (
                  <label class="preview-controls__check">
                    <input
                      type="checkbox"
                      name="availableLocales"
                      value={locale}
                      checked={query.availableLocales?.includes(locale)}
                    />
                    {LOCALE_NAMES[locale]}
                  </label>
                ),
              )}
            </div>
          </Field>

          <CheckField
            label="KI-agent"
            param="aiAgent"
            description="Krever feature-flagget ai-agent i appene."
            inactive={simple && "Skjult fordi «Enkel side» er på."}
            name="aiAgent"
            checked={query.aiAgent === "true"}
          />

          <Field
            label="Varsler"
            param="hideNotifications"
            inactive={
              simple
                ? "Skjult fordi «Enkel side» er på."
                : !signedIn && "Vises bare for innlogget bruker."
            }
          >
            <div class="preview-controls__choices">
              {notificationsOptions.map((option) => (
                <label class="preview-controls__check">
                  <input
                    type="radio"
                    name="notifications"
                    value={option.value}
                    checked={notifications === option.value}
                    data-preview-notifications
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {/* The page script sets these from the radio buttons above. */}
            <input
              type="hidden"
              name="hideNotifications"
              value="true"
              disabled={notifications !== "hidden"}
              data-preview-hide-notifications
            />
            {production ? null : (
              <input
                type="hidden"
                name="debugNotifications"
                value={notifications === "hidden" ? "max" : notifications}
                disabled={notifications === "hidden" || notifications === "max"}
                data-preview-notifications-count
              />
            )}
          </Field>
        </Section>
      </form>

      {/* This is outside the form, so the tabs and copy buttons do not submit it.
          The tabs are radio buttons, and the stylesheet shows the block for the
          checked tab. */}
      <section class="preview-code" aria-labelledby="preview-code-title">
        <h2 class="preview-code__title" id="preview-code-title">
          Bruk i appen
        </h2>
        <div class="preview-code__head">
          <div class="preview-code__tabs" role="radiogroup" aria-label="Kodeeksempel">
            {CODE_EXAMPLE_IDS.map((example) => (
              <label class="preview-code__tab">
                <input
                  type="radio"
                  name="previewCode"
                  value={example}
                  checked={example === "layout"}
                  data-preview-code-tab
                />
                {CODE_EXAMPLES[example].label}
              </label>
            ))}
          </div>
          <button class="preview-controls__copy" type="button" data-preview-copy-code>
            Kopier kode
          </button>
        </div>
        {CODE_EXAMPLE_IDS.map((example) => (
          <pre class="preview-code__block" data-preview-code={example}>
            <code>{previewCode(query, example, environment)}</code>
          </pre>
        ))}

        <h3 class="preview-code__subtitle">Lenke til denne visningen</h3>
        <div class="preview-controls__url">
          <code class="preview-controls__url-text" data-preview-url>
            {url}
          </code>
          <button class="preview-controls__copy" type="button" data-preview-copy>
            Kopier lenke
          </button>
        </div>
      </section>
    </div>
  );
}
