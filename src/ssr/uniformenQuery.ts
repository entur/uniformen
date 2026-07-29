import { z } from "@hono/zod-openapi";
import { parseAppName } from "./appName";

/**
 * Query parameters shared by `/ssr` and the preview page, so the two can't
 * drift.
 */
export const uniformenQuerySchema = z.object({
  app: z.enum(["partner", "sorvis", "cleos"]).optional(),
  // Whether the app has a side navigation to collapse — a capability, not a
  // state. The state is restored on the client from storage, so the same markup
  // serves every user of the app.
  sidebar: z.enum(["true", "false"]).optional(),
});

export type UniformenQuery = z.infer<typeof uniformenQuerySchema>;

/** Query params as the props `TopNavigation` takes. */
export function topNavigationProps({ app, sidebar }: UniformenQuery) {
  return { appName: parseAppName(app), sidebar: sidebar === "true" };
}
