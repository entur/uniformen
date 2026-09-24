import type { Environment, UniformenLayout, FetchUniformenParams } from "../types";

// TODO Add retry logic
// TODO Add caching logic and cache invalidation strategy

/**
 * How long to wait for the layout before the page renders without it. Every page
 * render waits for the header, so without a limit a slow Uniformen makes the app
 * slow. The service also waits five seconds for its own upstream services.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

const ENVIRONMENT_HOSTNAMES: Record<Environment, string> = {
  local: "http://localhost:4123",
  dev: "https://uniformen.dev.entur.no",
  staging: "https://uniformen.staging.entur.no",
  production: "https://uniformen.entur.no",
} as const;

/**
 * Returns the query string for the SSR endpoint. An array repeats the key
 * (`list=a&list=b`), because that is how the service reads lists. `undefined`
 * values are left out so they are not sent as the string "undefined". If no
 * values are left, it returns an empty string without `?`.
 */
function buildQueryString(params?: FetchUniformenParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) search.append(key, String(item));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type FetchUniformenLayoutProps = {
  /** The signed-in user's Auth0 access token. It is sent as a bearer token, and the top bar then shows the user. Leave it out for an anonymous top bar. */
  token?: string;
  /** The Uniformen environment to fetch the layout from. The default is `production`. */
  environment?: Environment;
  /** The query parameters for the layout. See `FetchUniformenParams`. */
  params?: FetchUniformenParams;
  /** How many milliseconds to wait for the service before the call returns `null`. The default is 5000. */
  timeoutMs?: number;
};

/**
 * Fetches the header, footer, head assets, scripts and CSP sources from Uniformen.
 * Returns `null` if the service answers with an error status, the request fails
 * or the timeout is reached.
 */
export async function fetchUniformenLayout({
  environment = "production",
  params,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchUniformenLayoutProps = {}): Promise<UniformenLayout | null> {
  const url = `${ENVIRONMENT_HOSTNAMES[environment]}/ssr${buildQueryString(params)}`;
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const {
      headerHtml = "",
      footerHtml = "",
      headAssets = "",
      scripts = "",
      csp = {},
    } = (await res.json()) as UniformenLayout;
    return {
      headerHtml,
      footerHtml,
      headAssets,
      scripts,
      csp,
    };
  } catch (e) {
    // Log a timeout with its own message. It usually means the service is
    // unhealthy, and a generic network error would point the reader to the wrong cause.
    if (e instanceof Error && e.name === "TimeoutError") {
      console.error(`Uniformen layout request timed out after ${timeoutMs}ms`);
      return null;
    }
    console.error("Failed to fetch Uniformen layout", e);
    return null;
  }
}
