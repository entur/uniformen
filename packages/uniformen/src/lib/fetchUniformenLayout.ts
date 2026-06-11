import type { Environment, UniformenLayout } from "../types";

// TODO Add retry logic
// TODO Add caching logic and cache invalidation strategy

const ENVIRONMENT_HOSTNAMES: Record<Environment, string> = {
  local: "http://localhost:4123",
  dev: "https://uniformen.dev.entur.no",
  staging: "https://uniformen.staging.entur.no",
  production: "https://uniformen.entur.no",
} as const;

export async function fetchUniformenLayout(
  token?: string,
  environment: Environment = "production",
): Promise<UniformenLayout | null> {
  const url = `${ENVIRONMENT_HOSTNAMES[environment]}/ssr`;
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
