import { z } from "@hono/zod-openapi";
import { PORTAL_APPLICATION_IDS, portalApplicationName } from "../components/portalApplications";
import { LOCALES } from "../types";

/**
 * Query parameters shared by `/ssr` and the preview page, so the two can't
 * drift.
 */
export const uniformenQuerySchema = z
  .object({
    // The application asking for the header, named by its portal id: it gets its
    // name beside the logo and its entry in the app switcher marked as current.
    // The accepted values are the portal application list itself: listing an
    // application there is what makes it a valid `app` value.
    app: z.enum(PORTAL_APPLICATION_IDS).optional(),
    // Whether the app has a side navigation to collapse — a capability, not a
    // state. The state is restored on the client from storage, so the same markup
    // serves every user of the app.
    sidebar: z.enum(["true", "false"]).optional(),
    // Paints the bar in the design system's contrast palette — the on-dark variant,
    // for an app whose page behind the header is dark.
    contrast: z.enum(["true", "false"]).optional(),
    // Hides the app switcher, notifications, the sidebar toggle and "Mine tilganger".
    // For pages that are not the app: login, error, terms.
    simple: z.enum(["true", "false"]).optional(),
    // Where the anonymous bar's login link goes; absent renders no link. A path on
    // the app's own origin only — an absolute URL, `//host` (`/\host` too, browsers
    // read it the same) or `javascript:` would aim the link off the app.
    loginUrl: z
      .string()
      .max(512)
      .regex(/^\/(?![/\\])[^\s"'<>]*$/, "loginUrl must be a path, e.g. /auth/login")
      .optional(),
    // Where the signed-in user's menu leads out; absent renders no logout row. Same
    // path-only rule as `loginUrl`, for the same reason: the session belongs to the
    // consuming app, and a URL is not allowed to aim the way out off it.
    logoutUrl: z
      .string()
      .max(512)
      .regex(/^\/(?![/\\])[^\s"'<>]*$/, "logoutUrl must be a path, e.g. /auth/logout")
      .optional(),
    // Defaulted, not optional: components take it required, no per-component fallback.
    locale: z.enum(LOCALES).default("nb-NO"),
    // The languages the consuming app offers, as a repeated key
    // (`?availableLocales=nb-NO&availableLocales=en-GB`), in the order they are to be listed. Not the
    // service's supported set: an app that translates two of the three must offer two.
    // Absent renders no switcher.
    //
    // A single value arrives as a string, an array only from the second onwards, so it
    // is widened before the array is validated — one language is a legitimate list.
    availableLocales: z
      .preprocess(
        (value) => (value === undefined || Array.isArray(value) ? value : [value]),
        z.array(z.enum(LOCALES)).nonempty(),
      )
      .optional(),
  })
  // Cross-field, so it can't live on the field itself. Both are the caller
  // contradicting itself rather than a value we could pick a sensible reading of:
  // a list that repeats a language would render it twice, and one that leaves out
  // the language being rendered would leave every option unchecked.
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

/** Query params as the props `TopNavigation` takes. */
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
    // `simple` wins over `sidebar`. The app sets `sidebar`, the page sets `simple`,
    // so both arriving together is ordinary rather than a 400.
    sidebar: !simpleMode && sidebar === "true",
    simple: simpleMode,
    contrast: contrast === "true",
    locale,
    availableLocales,
    loginUrl,
    logoutUrl,
  };
}
