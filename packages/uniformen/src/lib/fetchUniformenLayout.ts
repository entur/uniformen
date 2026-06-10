import type { UniformenLayout } from "../types";

// TODO Support multiple environments (dev, staging, prod)
// TODO Add retry logic
// TODO Add caching logic and cache invalidation strategy

const UNIFORMEN_SSR_URL = "https://uniformen.entur.no/ssr";

export async function fetchUniformenLayout(): Promise<UniformenLayout | null> {
  try {
    const res = await fetch(UNIFORMEN_SSR_URL);
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
