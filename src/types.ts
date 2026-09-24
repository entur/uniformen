/** Supported locales as BCP 47 tags, matched exactly. Add a new language here. */
export const LOCALES = ["nb-NO", "nn-NO", "en-GB"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * The label of the language control. It is not translated, so a user who cannot
 * read the current language can still find it. Bokmål and nynorsk both use
 * "Språk", so there is one Norwegian word.
 */
export const LANGUAGE_LABEL = "Språk / Language";

/**
 * Each language's name, written in that language. They are not translated, so
 * users can find their own language even if they cannot read the current one.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  "nb-NO": "Norsk bokmål",
  "nn-NO": "Norsk nynorsk",
  "en-GB": "English",
};
