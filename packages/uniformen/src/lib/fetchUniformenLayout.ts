import type { Environment, UniformenLayout, FetchUniformenParams } from "../types";
import { PACKAGE_VERSION } from "../version";

/**
 * How long to wait for the layout, retry included, before the call gives up. Every
 * page render waits for the header, so this limit is the most a slow Uniformen can
 * add to a render.
 */
const DEFAULT_TIMEOUT_MS = 1_000;

/**
 * How long a cached layout can be used when Uniformen fails. An anonymous layout is
 * the same for everyone, so it is kept for a day. A signed-in layout contains the
 * user's name, so it is kept for a shorter time.
 */
const ANONYMOUS_STALE_MS = 24 * 60 * 60_000;
const SIGNED_IN_STALE_MS = 60 * 60_000;

/**
 * The most layouts the cache holds. Each signed-in user adds entries, so without a
 * limit the cache would grow for as long as the process runs.
 */
const MAX_CACHE_ENTRIES = 500;

/** Tells the service which version of this package made the request. */
const CLIENT_HEADER = { "X-Uniformen-Client": `@entur/uniformen@${PACKAGE_VERSION}` };

const ENVIRONMENT_HOSTNAMES: Record<Environment, string> = {
  local: "http://localhost:4123",
  dev: "https://uniformen.dev.entur.no",
  staging: "https://uniformen.staging.entur.no",
  production: "https://uniformen.entur.no",
} as const;

type CacheEntry = {
  layout: UniformenLayout;
  /** Until this time the layout is used without asking Uniformen. */
  freshUntil: number;
  /** Until this time the layout is used when Uniformen fails. */
  staleUntil: number;
};

/**
 * Layouts keyed by URL, and for a signed-in user also by a hash of the token. A
 * `Map` keeps insertion order, so the first key is the least recently used one.
 */
const cache = new Map<string, CacheEntry>();

/**
 * Requests that are running now, by cache key. Calls with the same key wait for the
 * same request, so an expired entry gives one request to Uniformen instead of one
 * per render. A caller that joins a running request also uses its `timeoutMs`.
 */
const inFlight = new Map<string, Promise<UniformenLayout | null>>();

/**
 * Removes all cached layouts. Call it if your app must show a new layout at once,
 * for example after a Uniformen deploy.
 */
export function clearUniformenLayoutCache(): void {
  cache.clear();
}

function readCache(key: string): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.staleUntil <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Move the entry to the end, so it is the last one to be evicted.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function writeCache(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/**
 * Returns the cache key. For a signed-in user it includes a SHA-256 hash of the
 * token, so each user gets their own entry. The hash is used instead of the token
 * itself, so the cache does not keep access tokens in memory after the request.
 * Returns `undefined` when the runtime cannot hash, for example a browser page that
 * is not served over HTTPS. The signed-in layout is then not cached.
 */
async function cacheKey(url: string, token?: string): Promise<string | undefined> {
  if (!token) return url;
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${url} ${hash}`;
}

/**
 * Returns how many milliseconds the response may be used without asking again,
 * from the `max-age` in its `Cache-Control` header. Returns 0 if there is no
 * `max-age` or the header says `no-store`.
 */
function freshLifetimeMs(res: Response): number {
  const cacheControl = res.headers.get("Cache-Control") ?? "";
  if (/no-store/i.test(cacheControl)) return 0;
  const maxAge = /max-age=(\d+)/i.exec(cacheControl)?.[1];
  return maxAge ? Number(maxAge) * 1_000 : 0;
}

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

/**
 * Fetches the layout and returns it with its fresh lifetime. Tries once more if the
 * request fails with a network error or a 5xx status and the time budget is not
 * used up. A 4xx status means the request is wrong, so it is not retried.
 */
async function fetchLayout(
  url: string,
  token: string | undefined,
  timeoutMs: number,
): Promise<{ layout: UniformenLayout; freshMs: number } | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = token ? { ...CLIENT_HEADER, Authorization: `Bearer ${token}` } : CLIENT_HEADER;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers, signal });
      if (!res.ok) {
        // Cancel the unread body, so the connection is released at once.
        await res.body?.cancel();
        console.error(`Uniformen layout request failed with status ${res.status}`);
        if (res.status < 500) return null;
        continue;
      }
      // The body comes from the network, so a field can be missing. `Partial` keeps
      // the defaults below meaningful.
      const body: Partial<UniformenLayout> = await res.json();
      const { headerHtml = "", footerHtml = "", headAssets = "", scripts = "", csp = {} } = body;
      return {
        layout: { headerHtml, footerHtml, headAssets, scripts, csp },
        freshMs: freshLifetimeMs(res),
      };
    } catch (e) {
      // Log a timeout with its own message. It usually means the service is
      // unhealthy, and a generic network error would point the reader to the wrong cause.
      if (signal.aborted) {
        console.error(`Uniformen layout request timed out after ${timeoutMs}ms`);
        return null;
      }
      console.error("Failed to fetch Uniformen layout", e);
    }
  }
  return null;
}

export type FetchUniformenLayoutProps = {
  /** The signed-in user's Auth0 access token. It is sent as a bearer token, and the top bar then shows the user. Leave it out for an anonymous top bar. */
  token?: string;
  /** The Uniformen environment to fetch the layout from. The default is `production`. */
  environment?: Environment;
  /** The query parameters for the layout. See `FetchUniformenParams`. */
  params?: FetchUniformenParams;
  /** How many milliseconds to wait for the service, retry included, before the call gives up. The default is 1000. */
  timeoutMs?: number;
};

/**
 * Fetches the header, footer, head assets, scripts and CSP sources from Uniformen.
 *
 * An anonymous layout is cached in memory for as long as the service's
 * `Cache-Control` header allows. A signed-in layout is always fetched. If the fetch
 * fails, the call returns the last layout it got for the same options and token, if
 * there is one. Otherwise it returns `null`.
 */
export async function fetchUniformenLayout({
  environment = "production",
  params,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchUniformenLayoutProps = {}): Promise<UniformenLayout | null> {
  const url = `${ENVIRONMENT_HOSTNAMES[environment]}/ssr${buildQueryString(params)}`;
  const key = await cacheKey(url, token);
  const cached = key === undefined ? undefined : readCache(key);
  if (cached && cached.freshUntil > Date.now()) return cached.layout;

  let pending = key === undefined ? undefined : inFlight.get(key);
  if (!pending) {
    pending = fetchAndCache(url, token, timeoutMs, key);
    if (key !== undefined) {
      inFlight.set(key, pending);
      void pending.finally(() => inFlight.delete(key));
    }
  }

  const layout = await pending;
  if (layout) return layout;
  if (cached) console.warn("Using a cached Uniformen layout because the fetch failed");
  return cached?.layout ?? null;
}

/**
 * Fetches the layout and writes it to the cache under `key`. Returns `null` if the
 * fetch fails. When `key` is `undefined`, the layout is not cached.
 */
async function fetchAndCache(
  url: string,
  token: string | undefined,
  timeoutMs: number,
  key: string | undefined,
): Promise<UniformenLayout | null> {
  const result = await fetchLayout(url, token, timeoutMs);
  if (!result) return null;
  if (key === undefined) return result.layout;
  const now = Date.now();
  writeCache(key, {
    layout: result.layout,
    // The service marks a signed-in layout `no-store`. It is only kept here for the
    // case where a later fetch fails, so it is never used while the service answers.
    freshUntil: token ? now : now + result.freshMs,
    staleUntil: now + (token ? SIGNED_IN_STALE_MS : ANONYMOUS_STALE_MS),
  });
  return result.layout;
}
