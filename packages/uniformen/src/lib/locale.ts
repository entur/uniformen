import type { Locale } from "../types";

/** The name of the cookie that stores the user's language choice. */
export const LOCALE_COOKIE = "entur_locale";

const LOCALES: ReadonlySet<string> = new Set<Locale>(["nb-NO", "nn-NO", "en-GB"]);

// `no` means Norwegian in general. Most users who send it read bokmål.
const LOCALE_BY_LANGUAGE = new Map<string, Locale>([
  ["nb", "nb-NO"],
  ["no", "nb-NO"],
  ["nn", "nn-NO"],
  ["en", "en-GB"],
]);

// RFC 9110: from 0 to 1, with at most three decimals.
const QVALUE_PATTERN = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/;

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// Allows only host names, so `domain` cannot add other attributes to the cookie.
const DOMAIN_PATTERN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

/**
 * Saves the user's language choice in a cookie. Works only in the browser.
 *
 * Without `domain`, only the current host gets the cookie. All apps on a domain must
 * use the same setting. Otherwise the browser sends two cookies with the same name.
 */
export function writeLocaleCookie(locale: Locale, options: { domain?: string } = {}): void {
  if (typeof document === "undefined") {
    throw new TypeError("writeLocaleCookie: call it in the browser, not on the server");
  }
  if (!LOCALES.has(locale)) {
    throw new TypeError(`writeLocaleCookie: unsupported locale ${JSON.stringify(locale)}`);
  }
  const { domain } = options;
  if (domain !== undefined && !DOMAIN_PATTERN.test(domain)) {
    throw new TypeError(`writeLocaleCookie: invalid domain ${JSON.stringify(domain)}`);
  }
  const attributes = [
    `${LOCALE_COOKIE}=${locale}`,
    "path=/",
    `max-age=${ONE_YEAR_IN_SECONDS}`,
    "samesite=lax",
  ];
  if (domain) attributes.push(`domain=${domain}`);
  if (globalThis.location?.protocol === "https:") attributes.push("secure");
  document.cookie = attributes.join("; ");
}

/**
 * Returns the value of the locale cookie from `document.cookie` or a `Cookie`
 * header. The value is not checked and can be anything.
 */
export function readLocaleCookie(cookieHeader: string | null | undefined): string | undefined {
  for (const pair of cookieHeader?.split(";") ?? []) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === LOCALE_COOKIE) {
      const value = pair.slice(separator + 1).trim();
      // RFC 6265 allows the value in double quotes.
      return /^".*"$/.test(value) ? value.slice(1, -1) : value;
    }
  }
  return undefined;
}

export type ResolveLocaleOptions<L extends Locale, F extends L = L> = {
  /** The language the user chose. */
  chosen?: string | null;

  /** An `Accept-Language` header, or a list such as `navigator.languages`. */
  acceptLanguage?: string | readonly string[] | null;

  supported: readonly L[];

  fallback: F;
};

/**
 * Returns the first of `chosen` and the languages in `acceptLanguage` that matches
 * a tag in `supported`, or else `fallback`. A tag also matches on the language part,
 * so `en-US` gives `en-GB`.
 */
export function resolveLocale<L extends Locale, F extends L = L>(
  options: ResolveLocaleOptions<L, F>,
): L {
  const { chosen, acceptLanguage, supported, fallback } = options;
  const candidates = [chosen ?? "", ...preferredLanguages(acceptLanguage)];
  for (const candidate of candidates) {
    const match = matchLocale(candidate, supported);
    if (match) return match;
  }
  return fallback;
}

/** Returns the language tags in `acceptLanguage`, the most preferred first. */
function preferredLanguages(
  acceptLanguage: string | readonly string[] | null | undefined,
): string[] {
  if (!acceptLanguage) return [];
  if (typeof acceptLanguage !== "string") return [...acceptLanguage];

  const ranges: { tag: string; q: number }[] = [];
  for (const part of acceptLanguage.split(",")) {
    const [tag = "", ...params] = part.split(";").map((p) => p.trim());
    if (!tag || tag === "*") continue;
    let q = 1;
    for (const param of params) {
      const [name = "", value = ""] = param.split("=").map((p) => p.trim());
      if (name.toLowerCase() === "q") q = QVALUE_PATTERN.test(value) ? Number(value) : 0;
    }
    // q=0 means the language is not acceptable. An invalid q is treated the same way.
    if (q === 0) continue;
    ranges.push({ tag, q });
  }
  // Not `toSorted`, because older browsers do not have it.
  // oxlint-disable-next-line unicorn/no-array-sort
  return ranges.sort((a, b) => b.q - a.q).map((range) => range.tag);
}

function matchLocale<L extends Locale>(tag: string, supported: readonly L[]): L | undefined {
  const normalized = tag.trim().toLowerCase().replaceAll("_", "-");
  if (!normalized) return undefined;
  const exact = supported.find((locale) => locale.toLowerCase() === normalized);
  if (exact) return exact;
  const byLanguage = LOCALE_BY_LANGUAGE.get(normalized.split("-")[0] ?? "");
  return supported.find((locale) => locale === byLanguage);
}
