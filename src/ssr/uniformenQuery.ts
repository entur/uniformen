import { z } from "@hono/zod-openapi";
import { parseAppName } from "./appName";

/**
 * Query parameters shared by `/ssr` and the preview page, so the two can't
 * drift.
 */
export const uniformenQuerySchema = z.object({
  app: z.enum(["partner", "sorvis", "cleos"]).optional(),
  // Opt in to the side navigation collapse control. The value is the app's
  // starting state, not just an on/off switch: the button ships with a matching
  // `aria-expanded`.
  sidebar: z.enum(["expanded", "collapsed"]).optional(),
});

export type UniformenQuery = z.infer<typeof uniformenQuerySchema>;

/** Query params as the props `TopNavigation` takes. */
export function topNavigationProps({ app, sidebar }: UniformenQuery) {
  return { appName: parseAppName(app), sidebar };
}
