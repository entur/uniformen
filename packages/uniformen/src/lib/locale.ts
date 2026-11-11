import type { Locale } from "../types";

/**
 * The recommended name for the cookie that stores the user's language choice. Write
 * it with `writeLocaleCookie`, read it with `readLocaleCookie`, and send the value
 * as `params.locale`. The Uniformen service does not read this cookie.
 */
export const LOCALE_COOKIE = "entur_locale";

const LOCALES: ReadonlySet<string> = new Set<Locale>(["nb-NO", "nn-NO", "en-GB"]);

/**
 * The locale to use for a tag that only matches on the language part, such as
 * `en-US` or `nb`. `no` is the code for Norwegian in general, and most users who
 * send it read bokmål.
 */
const LOCALE_BY_LANGUAGE = new Map<string, Locale>([
  ["nb", "nb-NO"],
  ["no", "nb-NO"],
  ["nn", "nn-NO"],
  ["en", "en-GB"],
]);

/** A q value as RFC 9110 allows it: from 0 to 1, with at most three decimals. */
const QVALUE_PATTERN = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/;

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Matches a host name such as `entur.org`. It rejects `;` and `=`, so `domain`
 * cannot add other attributes to the cookie.
 */
const DOMAIN_PATTERN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

/**
 * Saves the user's language choice in the `entur_locale` cookie. Call it only in
 * the browser, for example in your `uniformen:locale` listener, and then reload.
 *
 * The cookie is set for the whole site (`path=/`), for one year, with
 * `SameSite=Lax`, and with `Secure` on HTTPS. It is not `HttpOnly`, because the
 * browser writes it. It only holds a language tag, so it contains no personal data.
 *
 * Without `domain`, only the host that sets the cookie gets it back. With `domain`,
 * for example `"entur.org"`, all its subdomains get it. If two apps on the same
 * domain set the cookie with and without `domain`, the browser sends two cookies
 * with the same name. All apps on a domain must therefore use the same setting.
 * `domain` must be the page's host or a parent of it. Otherwise the browser ignores
 * the cookie without an error.
 *
 * Throws a `TypeError` when it runs outside the browser, when `locale` is not a tag
 * Uniformen supports, or when `domain` is not a host name.
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
 * Returns the value of the `entur_locale` cookie, or `undefined` if it is not set.
 * Pass `document.cookie` in the browser, or the `Cookie` request header on the
 * server.
 *
 * The value comes from the user and can be anything. Pass it to `resolveLocale` as
 * `chosen`, which ignores a value your app does not support.
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
  /**
   * The language the user chose, usually the value of the `entur_locale` cookie.
   * It is used first when it matches a tag in `supported`.
   */
  chosen?: string | null;

  /**
   * The languages the browser prefers. Pass the `Accept-Language` header on the
   * server and `navigator.languages` in the browser. A header is sorted by its
   * `q` values. A list is used in its own order.
   */
  acceptLanguage?: string | readonly string[] | null;

  /** The languages your app is translated into. */
  supported: readonly L[];

  /** The language to use when nothing else matches. It must be in `supported`. */
  fallback: F;
};

/**
 * Returns the language to render the page in. It checks `chosen` first, then
 * each language in `acceptLanguage` in order of preference, and returns the first
 * one that matches a tag in `supported`. If none of them matches, it returns
 * `fallback`.
 *
 * A tag matches when it is the same tag, in any case, or when its language part
 * matches. So `en-US` gives `en-GB`, and `nb` and `no` give `nb-NO`.
 *
 * The function only takes strings, so it works with any server framework and in
 * the browser. When the server and the browser call it with the same values, they
 * get the same language.
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

/**
 * Returns the language tags from `acceptLanguage`, the most preferred first. Tags
 * with `q=0` mean "not acceptable" and are left out, and so is `*`. Tags with the
 * same `q` keep their order.
 */
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
    // Leave out the tag when q is 0 or not a valid q value. q=0 means the language is
    // not acceptable.
    if (q === 0) continue;
    ranges.push({ tag, q });
  }
  // The sort is stable, so tags with the same q keep their order. `toSorted` is not
  // used because older browsers do not have it.
  // oxlint-disable-next-line unicorn/no-array-sort
  return ranges.sort((a, b) => b.q - a.q).map((range) => range.tag);
}

/** Returns the tag in `supported` that `tag` matches, or `undefined`. */
function matchLocale<L extends Locale>(tag: string, supported: readonly L[]): L | undefined {
  const normalized = tag.trim().toLowerCase().replaceAll("_", "-");
  if (!normalized) return undefined;
  const exact = supported.find((locale) => locale.toLowerCase() === normalized);
  if (exact) return exact;
  const byLanguage = LOCALE_BY_LANGUAGE.get(normalized.split("-")[0] ?? "");
  return supported.find((locale) => locale === byLanguage);
}
