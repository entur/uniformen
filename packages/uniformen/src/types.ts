export type Environment = "local" | "dev" | "staging" | "production";

export type FetchUniformenParams = {
  // Add any query parameters that should be sent to the Uniformen SSR endpoint here.
  // Array-valued params are serialised as a repeated key (`key=a&key=b`).
  app?: "partner" | "sorvis" | "cleos";
  /**
   * Render the side navigation collapse control in the top bar, starting in the
   * given state. Only set this if the app has a sidebar to collapse: the button
   * dispatches a `uniformen:toggle-sidebar` CustomEvent on `window` carrying
   * `{ collapsed: boolean }`, and the app is responsible for reacting to it.
   *
   * Pass the state the app actually renders with — an app that restores a
   * collapsed sidebar must send `"collapsed"`, or the button starts out of sync
   * and the first click appears to do nothing.
   */
  sidebar?: "expanded" | "collapsed";
};

export type UniformenLayout = {
  headerHtml: string;
  footerHtml: string;
  headAssets: string;
  scripts: string;
  // Per-directive CSP sources to union into the consumer's page CSP header.
  csp: Record<string, string[]>;
};
