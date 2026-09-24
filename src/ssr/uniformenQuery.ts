import { z } from "@hono/zod-openapi";
import { PORTAL_APPLICATION_IDS, portalApplicationName } from "../components/portalApplications";
import { LOCALES } from "../types";

/**
 * Query parameters for both `/ssr` and the preview page, so they always accept the
 * same values.
 */
export const uniformenQuerySchema = z
  .object({
    // The portal id of the app that asks for the header. Its name is shown next to
    // the logo, and it is marked as current in the app switcher. Only ids in the
    // portal application list are accepted.
    app: z.enum(PORTAL_APPLICATION_IDS).optional(),
    // Whether the app has a side navigation that can be collapsed. It does not say
    // whether the sidebar is collapsed. The browser restores that from storage, so
    // the markup is the same for every user.
    sidebar: z.enum(["true", "false"]).optional(),
    // Uses the design system's contrast colours, for apps with a dark page behind the
    // header.
    contrast: z.enum(["true", "false"]).optional(),
    // Hides the app switcher, notifications, the sidebar toggle and "Mine tilganger".
    // For pages that are not the app: login, error, terms.
    simple: z.enum(["true", "false"]).optional(),
    // The target of the login link for anonymous users. Without it, there is no link.
    // It must be a path on the app's own origin. An absolute URL, `//host`, `/\host`
    // (browsers treat it like `//host`) or `javascript:` could send the user to
    // another site.
    loginUrl: z
      .string()
      .max(512)
      .regex(/^\/(?![/\\])[^\s"'<>]*$/, "loginUrl must be a path, e.g. /auth/login")
      .optional(),
    // The target of the logout row in the user menu. Without it, there is no row. It
    // must be a path, for the same reason as `loginUrl`.
    logoutUrl: z
      .string()
      .max(512)
      .regex(/^\/(?![/\\])[^\s"'<>]*$/, "logoutUrl must be a path, e.g. /auth/logout")
      .optional(),
    // It has a default, so components can require it and need no fallback of their own.
    locale: z.enum(LOCALES).default("nb-NO"),
    // The languages the consuming app supports, in the order to list them. Repeat the
    // key for each one: `?availableLocales=nb-NO&availableLocales=en-GB`. Without it,
    // there is no language switcher.
    //
    // A single value arrives as a string, not an array, so it is wrapped in an array
    // before validation. A list with one language is valid.
    availableLocales: z
      .preprocess(
        (value) => (value === undefined || Array.isArray(value) ? value : [value]),
        z.array(z.enum(LOCALES)).nonempty(),
      )
      .optional(),
  })
  // These checks use two fields, so they cannot be on the field itself. A repeated
  // language would be listed twice. A list without `locale` would have no option
  // checked.
  .superRefine((query, ctx) => {
    if (!query.availableLocales) return;
    if (new Set(query.availableLocales).size !== query.availableLocales.length) {
      ctx.addIssue({
        code: "custom",
        path: ["availableLocales"],
        message: "availableLocales must not repeat",
      });
    } else if (!query.availableLocales.includes(query.locale)) {
      ctx.addIssue({
        code: "custom",
        path: ["availableLocales"],
        message: "availableLocales must include locale",
      });
    }
  });

export type UniformenQuery = z.infer<typeof uniformenQuerySchema>;

/** Converts the query parameters to `TopNavigation` props. */
export function topNavigationProps({
  app,
  sidebar,
  simple,
  contrast,
  locale,
  availableLocales,
  loginUrl,
  logoutUrl,
}: UniformenQuery) {
  const simpleMode = simple === "true";
  return {
    appName: portalApplicationName(app),
    activeAppId: app,
    // `simple` turns off `sidebar`. An app often sets `sidebar` for all its pages and
    // `simple` for some pages, so getting both is not an error.
    sidebar: !simpleMode && sidebar === "true",
    simple: simpleMode,
    contrast: contrast === "true",
    locale,
    availableLocales,
    loginUrl,
    logoutUrl,
  };
}
