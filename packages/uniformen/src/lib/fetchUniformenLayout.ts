import type { Environment, UniformenLayout, FetchUniformenParams } from "../types";

// TODO Add retry logic
// TODO Add caching logic and cache invalidation strategy

const ENVIRONMENT_HOSTNAMES: Record<Environment, string> = {
  local: "http://localhost:4123",
  dev: "https://uniformen.dev.entur.no",
  staging: "https://uniformen.staging.entur.no",
  production: "https://uniformen.entur.no",
} as const;

/**
 * Serialises params for the SSR endpoint:
 *  - an array repeats the key (`list=a&list=b`), which is how the
 *    service's query schema reads multi-valued params,
 *  - `undefined` values are dropped so they never arrive as the literal string
 *    "undefined",
 *  - an empty (or fully dropped) set yields no `?` at all.
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
  token?: string;
  environment?: Environment;
  params?: FetchUniformenParams;
};

export async function fetchUniformenLayout({
  environment = "production",
  params,
  token,
}: FetchUniformenLayoutProps = {}): Promise<UniformenLayout | null> {
  const url = `${ENVIRONMENT_HOSTNAMES[environment]}/ssr${buildQueryString(params)}`;
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
    console.error("Failed to fetch Uniformen layout", e);
    return null;
  }
}
