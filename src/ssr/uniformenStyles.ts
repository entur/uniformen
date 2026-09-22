import {
  borderRadiuses,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  shadows,
  space,
  zIndexes,
  primitive,
  semantic,
} from "@entur/tokens";
import uniformenCss from "./uniformen.css" with { type: "text" };
import { sha256Source } from "./sha256";
import { environment, type Environment } from "../config";

// @entur/tokens *.rem fields are unitless numbers (px/16). Append the unit here.
const rem = (n: number) => `${n}rem`;

// Env accent palette. Four shades per environment: `strip` paints the bar along
// the top of the header plus the pointer above the env badge, and
// `tint`/`border`/`text` style the badge itself. The text shade is the darkest
// of each hue so the label stays >=4.5:1 on the tint (local is a hand-picked
// purple, not a token hue).
const ENV_PALETTES = {
  local: { strip: "#B482FB", tint: "#F0E7FF", border: "#B482FB", text: "#5A2EA6" },
  dev: {
    strip: primitive.mint._60,
    tint: primitive.mint._20,
    border: primitive.mint._70,
    text: primitive.mint._80,
  },
  staging: {
    strip: primitive.canary._60,
    tint: primitive.canary._20,
    border: primitive.canary._70,
    text: primitive.canary._90,
  },
  production: {
    strip: primitive.coral._40,
    tint: primitive.coral._20,
    border: primitive.coral._40,
    text: primitive.coral._80,
  },
} satisfies Record<Environment, Record<string, string>>;

/**
 * Height of the coloured strip along the top of the header. Production gets
 * none: the strip (and the pointer under it) is a "you are not in prod"
 * warning, so in prod there is nothing to warn about.
 *
 * Zero carries a unit on purpose. The value is summed inside a `calc()` (the
 * app switcher panel's offset), and a unitless zero is a `<number>` there, not
 * a `<length>` — `calc(4rem + 0 + 0.25rem)` is invalid and drops the whole
 * declaration.
 */
export const envStripHeight = (env: Environment): string =>
  env === "production" ? "0rem" : "0.25rem";

/** The `:root` custom properties every component reads, resolved for one environment. */
export function buildRootVars(env: Environment): string {
  const palette = ENV_PALETTES[env];
  return `:root {
  --uniformen-color-brand-blue: ${colors.brand.blue};
  --uniformen-color-brand-white: ${colors.brand.white};
  --uniformen-color-brand-coral: ${colors.brand.coral};
  --uniformen-color-brand-lavender: ${colors.brand.lavender};
  --uniformen-color-blue-10: ${colors.blues.blue10};
  --uniformen-color-blue-20: ${primitive.blue._20};
  --uniformen-color-blue-40: ${colors.blues.blue40};
  --uniformen-color-blue-60: ${primitive.blue._60};
  --uniformen-color-blue-70: ${colors.blues.blue70};
  --uniformen-color-blue-80: ${colors.blues.blue80};
  --uniformen-color-blue-90: ${colors.blues.blue90};
  --uniformen-color-grey-30: ${primitive.grey._30};
  --uniformen-color-env: ${palette.strip};
  --uniformen-color-env-tint: ${palette.tint};
  --uniformen-color-env-border: ${palette.border};
  --uniformen-color-env-text: ${palette.text};
  --uniformen-env-strip-height: ${envStripHeight(env)};
  --uniformen-space-xs2: ${rem(space.rem.extraSmall2)};
  --uniformen-space-xs: ${rem(space.rem.extraSmall)};
  --uniformen-space-small: ${rem(space.rem.small)};
  --uniformen-space-medium: ${rem(space.rem.medium)};
  --uniformen-space-large: ${rem(space.rem.large)};
  --uniformen-font-xs: ${rem(fontSizes.rem.extraSmall)};
  --uniformen-font-md: ${rem(fontSizes.rem.medium)};
  --uniformen-font-lg: ${rem(fontSizes.rem.large)};
  --uniformen-font-xl: ${rem(fontSizes.rem.extraLarge)};
  --uniformen-font-xl2: ${rem(fontSizes.rem.extraLarge2)};
  --uniformen-line-xs: ${rem(lineHeights.rem.extraSmall)};
  --uniformen-line-md: ${rem(lineHeights.rem.medium)};
  --uniformen-weight-body: ${fontWeights.body};
  --uniformen-weight-heading: ${fontWeights.heading};
  --uniformen-radius-md: ${rem(borderRadiuses.rem.medium)};
  --uniformen-shadow-focus: ${shadows.focus};
  --uniformen-z-popover: ${zIndexes.popover};
}
`;
}

/**
 * Contrast mode: the same roles, painted for a navy bar. Scoped to the modifier
 * class rather than to `:root`, so a contrast header and a light one could be on
 * one page; everything under the header inherits, panels included.
 *
 * Every value comes from the design system's `contrast` variants — the same set
 * `@entur/layout`'s `<Contrast>` puts its children on.
 *
 * The environment badge is left alone. It is a tinted chip carrying its own
 * background, border and text, picked to hold 4.5:1 against that tint rather than
 * against whatever is behind it, so it reads on navy as it does on white.
 */
const CONTRAST_VARS = `.uniformen-top-nav--contrast {
  --uniformen-surface: ${semantic.fill.background.contrast.light};
  --uniformen-surface-hover: ${semantic.fill.background.contrast.lightalt};
  --uniformen-surface-active: ${semantic.fill.selected.hover.contrast};
  --uniformen-on-surface: ${semantic.text.light};
  --uniformen-divider: ${semantic.fill.selected.hover.contrast};
  --uniformen-panel: ${semantic.fill.background.contrast.lightalt2};
  --uniformen-panel-body: ${semantic.fill.background.contrast.light};
  --uniformen-panel-hover: ${semantic.fill.background.contrast.lightalt};
  --uniformen-panel-selected: ${semantic.fill.selected.hover.contrast};
  --uniformen-panel-border: ${semantic.fill.selected.hover.contrast};
  --uniformen-panel-border-strong: ${semantic.fill.selected.hover.contrast};
  --uniformen-on-panel: ${semantic.text.light};
  --uniformen-on-panel-subdued: ${semantic.text.contrast};
  --uniformen-shadow-bar: ${shadows.boxShadowContrast};
  --uniformen-shadow-panel: ${shadows.cardShadowContrast};
  --uniformen-shadow-focus: ${shadows.focusContrast};
}
`;

// Resolved once at startup for the environment this instance serves.
const UNIFORMEN_CSS = buildRootVars(environment).trim() + uniformenCss.trim() + CONTRAST_VARS;

export const uniformenCssHash = await sha256Source(UNIFORMEN_CSS);

export const renderUniformenStyleTag = () => {
  return `<style>${UNIFORMEN_CSS}</style>` as const;
};
