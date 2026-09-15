export type Environment = "local" | "dev" | "staging" | "production";

/** BCP 47 tags: bokmål, nynorsk, English. */
export type Locale = "nb-NO" | "nn-NO" | "en-GB";

/**
 * Parameters for fetching Uniformen layouts.
 */
export type FetchUniformenParams = {
  /**
   * The portal application asking for the layout. It gets its name beside the
   * Entur logo.
   */
  app?: "cleos" | "nplan" | "ops-center" | "partner" | "skoleskyss" | "sorvis";

  /** Language of the header and footer, default `nb-NO`. App names and env labels are untranslated. */
  locale?: Locale;

  /**
   * Languages to offer in the top bar's language switcher, in this order. Omitted
   * or empty renders no switcher — set it only to the tags your own app translates,
   * not to everything the service supports.
   *
   * A group of radio items, never in two places at once: a section of the signed-in
   * user's menu wherever there is one, `simple` included, and a control of its own —
   * globe plus the current language, left of the login link — on the anonymous bar,
   * which has none. `locale` is the option rendered as current, and must be one of
   * `availableLocales`: a repeat, an unknown tag, or a list without `locale` is
   * rejected by the service with `400`, so the call returns `null`.
   *
   * A pick dispatches `uniformen:locale` on `window` and does nothing else — no
   * cookie, no storage, no reload, no re-labelling of the bar. Persisting the choice
   * and reloading are yours, because only a new document can change the language of
   * a server-rendered header and of your own texts:
   *
   *   window.addEventListener("uniformen:locale", (event) => {
   *     const { locale } = event.detail;
   *     // persist however your app persists it, then:
   *     window.location.reload();
   *   });
   *
   * Send the stored choice back as `locale` on the next render, and set `<html lang>`
   * to match.
   */
  availableLocales?: Locale[];

  /**
   * Render the side navigation collapse control in the top bar. Set it only if the
   * app has a sidebar to collapse.
   *
   * The sidebar's state is `data-uniformen-sidebar` on `<html>`
   * (`"expanded" | "collapsed"`), restored from the user's stored preference before
   * first paint. Style your sidebar off that attribute and it needs no JavaScript
   * state at all:
   *
   *   :root[data-uniformen-sidebar="collapsed"] .my-sidebar {
   *     width: 0;
   *     visibility: hidden; // else the collapsed links stay focusable
   *   }
   *
   * Write the attribute to collapse from elsewhere in the app, and listen for
   * `uniformen:sidebar` on `window` if you need to react in script. Server-render the
   * attribute to pick a different default: it is only written for you when the user
   * has a stored preference, or when nothing has set it at all.
   */
  sidebar?: boolean;

  /**
   * Where the top bar's "Logg inn" link points, on a render with no `token`. Omitted
   * renders no login link — logging in is your route, and the service does not guess
   * it. A path on your own origin: an absolute URL, `//host` or `javascript:` is a
   * `400`, so the call returns `null`.
   */
  loginUrl?: string;

  /**
   * Where the top bar's "Logg ut" row points, in the user menu a `token` renders.
   * Omitted renders no logout row — signing out ends your session, not ours, so the
   * route is yours to name. A path on your own origin: an absolute URL, `//host` or
   * `javascript:` is a `400`, so the call returns `null`.
   */
  logoutUrl?: string;

  /**
   * Barebones top bar: hides the app switcher, notifications, the sidebar toggle
   * (whatever `sidebar` says) and "Mine tilganger". Left: logo and app name, plus the
   * environment badge for the users who get one at all; right: the `loginUrl` login
   * link, or the user's name over a menu of the `logoutUrl` row alone. For login,
   * error and terms pages. Per page, not per app.
   */
  simple?: boolean;
};

export type UniformenLayout = {
  headerHtml: string;
  footerHtml: string;
  headAssets: string;
  scripts: string;
  // Per-directive CSP sources to union into the consumer's page CSP header.
  csp: Record<string, string[]>;
};

/**
 * The two events the top bar dispatches on `window`, typed. Loaded with any import
 * from the package, so `event.detail` is checked in a plain `addEventListener` —
 * no import, no wrapper, no cast:
 *
 *   window.addEventListener("uniformen:sidebar", (event) => {
 *     setCollapsed(event.detail.collapsed);
 *   });
 *
 * Declarations only: dispatching stays the service's, subscribing stays the DOM's.
 */
declare global {
  interface WindowEventMap {
    /** A language was picked in the switcher. See `FetchUniformenParams.availableLocales`. */
    "uniformen:locale": CustomEvent<{ locale: Locale }>;

    /** `data-uniformen-sidebar` changed, by our button or the app. See `FetchUniformenParams.sidebar`. */
    "uniformen:sidebar": CustomEvent<{ collapsed: boolean }>;
  }
}
