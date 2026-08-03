export type Environment = "local" | "dev" | "staging" | "production";

/** BCP 47 tags: bokmål, nynorsk, English. */
export type Locale = "nb-NO" | "nn-NO" | "en-GB";

/**
 * Parameters for fetching Uniformen layouts.
 */
export type FetchUniformenParams = {
  /**
   * The portal application asking for the layout. It gets its name beside the
   * Entur logo, and its entry in the app switcher marked as the current page.
   */
  app?: "cleos" | "nplan" | "ops-center" | "partner" | "sorvis";

  /** Language of the header and footer, default `nb-NO`. App names and env labels are untranslated. */
  locale?: Locale;

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
};

export type UniformenLayout = {
  headerHtml: string;
  footerHtml: string;
  headAssets: string;
  scripts: string;
  // Per-directive CSP sources to union into the consumer's page CSP header.
  csp: Record<string, string[]>;
};
