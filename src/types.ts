/** BCP 47 tags, exact match. Source of the query schema's enum: add a language here. */
export const LOCALES = ["nb-NO", "nn-NO", "en-GB"] as const;

export type Locale = (typeof LOCALES)[number];
