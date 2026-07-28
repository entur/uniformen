export type Environment = "local" | "dev" | "staging" | "production";

export type FetchUniformenParams = {
  // Add any query parameters that should be sent to the Uniformen SSR endpoint here.
  // Array-valued params are serialised as a repeated key (`key=a&key=b`).
  app?: "partner" | "sorvis" | "cleos";
};

export type UniformenLayout = {
  headerHtml: string;
  footerHtml: string;
  headAssets: string;
  scripts: string;
  // Per-directive CSP sources to union into the consumer's page CSP header.
  csp: Record<string, string[]>;
};
