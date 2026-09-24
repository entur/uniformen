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

// The `rem` fields in @entur/tokens are numbers without a unit (px divided by 16).
const rem = (n: number) => `${n}rem`;

// Colours per environment. `strip` is used for the strip along the top of the header
// and the pointer above the badge. `tint`, `border` and `text` are used for the badge.
// The text colour is dark enough for a contrast of at least 4.5:1 on the tint. The
// local colours are picked by hand, not taken from the tokens.
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
 * Returns the height of the coloured strip along the top of the header. The strip
 * warns that this is not production, so production has no strip.
 *
 * Zero must have a unit. The value is used inside a `calc()`, and there a zero
 * without a unit is a number, not a length. `calc(4rem + 0 + 0.25rem)` is invalid,
 * and the browser ignores the whole declaration.
 */
export const envStripHeight = (env: Environment): string =>
  env === "production" ? "0rem" : "0.25rem";

/** Returns the `:root` CSS variables that all components use, for one environment. */
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
 * Colours for contrast mode, for a navy bar. They are set on the modifier class, not
 * on `:root`, so they only apply inside a contrast header, including its panels. All
 * values are the design system's `contrast` variants.
 *
 * The environment badge keeps its colours. It has its own background, so its text
 * contrast does not depend on the bar colour.
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

// Built once at startup, for the environment this instance runs in.
const UNIFORMEN_CSS = buildRootVars(environment).trim() + uniformenCss.trim() + CONTRAST_VARS;

export const uniformenCssHash = await sha256Source(UNIFORMEN_CSS);

export const renderUniformenStyleTag = () => {
  return `<style>${UNIFORMEN_CSS}</style>` as const;
};
