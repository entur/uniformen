export type Environment = "local" | "dev" | "staging" | "production";

/** A BCP 47 language tag: `nb-NO` is Norwegian bokmål, `nn-NO` is Norwegian nynorsk and `en-GB` is English. */
export type Locale = "nb-NO" | "nn-NO" | "en-GB";

/**
 * Parameters for fetching Uniformen layouts.
 */
export type FetchUniformenParams = {
  /**
   * The portal application that asks for the layout. The top bar shows its name
   * next to the Entur logo. An unknown value makes the service answer `400`, and the
   * call returns `null`.
   */
  app?: "bedrift" | "cleos" | "nplan" | "ops-center" | "partner" | "skoleskyss" | "sorvis";

  /**
   * The language of the header and footer. The default is `nb-NO`. App names and
   * environment labels are not translated.
   */
  locale?: Locale;

  /**
   * The languages to offer in the language switcher in the top bar, in this order.
   * If you leave it out or pass an empty list, no switcher is shown. Only list the
   * languages your own app is translated into.
   *
   * The switcher is a group of radio items. If a user is signed in, it is a section
   * of the user menu, also when `simple` is set. On the anonymous top bar it is a
   * separate control to the left of the login link, with a globe and the current
   * language. `locale` is shown as the selected option and must be in the list. If
   * the list has a repeated tag, an unknown tag or does not contain `locale`, the
   * service answers `400` and the call returns `null`.
   *
   * When the user picks a language, the top bar dispatches `uniformen:locale` on
   * `window` and does nothing else. It does not set a cookie, store anything, reload
   * or change the labels in the bar. Your app must store the choice and reload the
   * page, because the header is rendered on the server:
   *
   *   window.addEventListener("uniformen:locale", (event) => {
   *     const { locale } = event.detail;
   *     // persist however your app persists it, then:
   *     window.location.reload();
   *   });
   *
   * On the next render, send the stored choice as `locale` and set `<html lang>` to
   * the same value.
   */
  availableLocales?: Locale[];

  /**
   * Shows a button in the top bar that collapses and expands the side navigation.
   * The default is `false`. Only set it if your app has a sidebar.
   *
   * The state is stored in the `data-uniformen-sidebar` attribute on `<html>`, with
   * the value `"expanded"` or `"collapsed"`. The user's stored preference is set on
   * the attribute before the first paint. Style your sidebar based on the attribute,
   * so you need no JavaScript state:
   *
   *   :root[data-uniformen-sidebar="collapsed"] .my-sidebar {
   *     width: 0;
   *     visibility: hidden; // else the collapsed links stay focusable
   *   }
   *
   * To collapse the sidebar from other places in your app, write the attribute. To
   * react to changes in script, listen for `uniformen:sidebar` on `window`. To use a
   * different default, render the attribute on the server. Uniformen only writes the
   * attribute when the user has a stored preference or when the attribute is not set.
   */
  sidebar?: boolean;

  /**
   * The path that the "Logg inn" link in the top bar points to. The link is only
   * shown when no `token` is passed. If you leave it out, no login link is shown. It
   * must be a path on your own origin. An absolute URL, `//host` or `javascript:`
   * makes the service answer `400`, and the call returns `null`.
   */
  loginUrl?: string;

  /**
   * The path that the "Logg ut" row in the user menu points to. The user menu is
   * only shown when a `token` is passed. If you leave it out, no logout row is shown.
   * It must be a path on your own origin. An absolute URL, `//host` or `javascript:`
   * makes the service answer `400`, and the call returns `null`.
   */
  logoutUrl?: string;

  /**
   * Shows the top bar in a dark blue contrast color scheme. The default is `false`.
   */
  contrast?: boolean;

  /**
   * Shows a minimal top bar. The default is `false`. It hides the app switcher,
   * notifications, the sidebar button (even if `sidebar` is set) and "Mine
   * tilganger". The left side shows the logo, the app name and, for users who get
   * one, the environment badge. The right side shows the login link from `loginUrl`,
   * or the user's name with a menu that only has the `logoutUrl` row.
   *
   * Use it on login, error and terms pages. Set it per page, not for the whole app.
   */
  simple?: boolean;
};

export type UniformenLayout = {
  headerHtml: string;
  footerHtml: string;
  headAssets: string;
  scripts: string;
  // CSP sources per directive. Merge them into the Content-Security-Policy header of your page.
  csp: Record<string, string[]>;
};

/**
 * Adds types for the two events the top bar dispatches on `window`. They are
 * available after any import from the package, so `event.detail` is typed in a
 * plain `addEventListener` call without an import or a cast:
 *
 *   window.addEventListener("uniformen:sidebar", (event) => {
 *     setCollapsed(event.detail.collapsed);
 *   });
 */
declare global {
  interface WindowEventMap {
    /** Fires when the user picks a language in the switcher. See `FetchUniformenParams.availableLocales`. */
    "uniformen:locale": CustomEvent<{ locale: Locale }>;

    /** Fires when `data-uniformen-sidebar` changes, from the top bar button or from your app. See `FetchUniformenParams.sidebar`. */
    "uniformen:sidebar": CustomEvent<{ collapsed: boolean }>;
  }
}
