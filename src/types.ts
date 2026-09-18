/** BCP 47 tags, exact match. Source of the query schema's enum: add a language here. */
export const LOCALES = ["nb-NO", "nn-NO", "en-GB"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * What the language control is called, and the one string in the bar that is not
 * translated into the current locale: it is the signpost for a user who cannot read
 * that locale, so a Norwegian page has to say "Language" too. Both Norwegian
 * written standards call it the same thing, so bokmål and nynorsk share a side.
 */
export const LANGUAGE_LABEL = "Språk / Language";

/**
 * Each language named in itself, never translated into the current one: a label
 * you can't read is one you can't pick your way out of.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  "nb-NO": "Norsk bokmål",
  "nn-NO": "Norsk nynorsk",
  "en-GB": "English",
};
