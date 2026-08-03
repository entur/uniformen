import { z } from "@hono/zod-openapi";
import { PORTAL_APPLICATION_IDS, portalApplicationName } from "../components/portalApplications";
import { LOCALES } from "../types";

/**
 * Query parameters shared by `/ssr` and the preview page, so the two can't
 * drift.
 */
export const uniformenQuerySchema = z.object({
  // The application asking for the header, named by its portal id: it gets its
  // name beside the logo and its entry in the app switcher marked as current.
  // The accepted values are the portal application list itself: listing an
  // application there is what makes it a valid `app` value.
  app: z.enum(PORTAL_APPLICATION_IDS).optional(),
  // Whether the app has a side navigation to collapse — a capability, not a
  // state. The state is restored on the client from storage, so the same markup
  // serves every user of the app.
  sidebar: z.enum(["true", "false"]).optional(),
  // Defaulted, not optional: components take it required, no per-component fallback.
  locale: z.enum(LOCALES).default("nb-NO"),
});

export type UniformenQuery = z.infer<typeof uniformenQuerySchema>;

/** Query params as the props `TopNavigation` takes. */
export function topNavigationProps({ app, sidebar, locale }: UniformenQuery) {
  return {
    appName: portalApplicationName(app),
    activeAppId: app,
    sidebar: sidebar === "true",
    locale,
  };
}
