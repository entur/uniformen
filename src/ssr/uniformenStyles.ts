import {
  borderRadiuses,
  colors,
  componentVariables,
  data,
  componentColors,
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

// Colours for the secondary button in the Entur design system.
const secondaryButton = componentVariables.light.components.button.secondary;

// Colours for the icon button in the Entur design system.
const iconButton = componentVariables.light.components.button.iconButton;

// Colours for the drawer in the Entur design system.
const drawer = componentVariables.light.components.modal.drawer;

// Colours for the side navigation in the Entur design system. Its hover colour is
// used for hover in the panels.
const sideNavigation = componentVariables.light.components.menu.sideNavigation;

// Colours for the floating button in the Entur design system.
const floatingButton = componentVariables.light.components.button.floating;

// Dark mode uses the dark theme's floating button.
const darkFloatingButton = componentVariables.dark.components.button.floating;

// Colours for form fields in the Entur design system.
const form = componentVariables.light.components.form.baseForm;

// The dark theme's colours for the same components.
const darkSecondaryButton = componentVariables.dark.components.button.secondary;
const darkIconButton = componentVariables.dark.components.button.iconButton;
const darkDrawer = componentVariables.dark.components.modal.drawer;
const darkForm = componentVariables.dark.components.form.baseForm;

// The `rem` fields in @entur/tokens are numbers without a unit (px divided by 16).
const rem = (n: number) => `${n}rem`;

// Colours for one environment badge in one colour mode. `pointer` is the triangle
// above the badge. `fill` and `fillHover` are the badge background, and `text` is
// used for the label and the chevron. The border is 2px wide in every mode. A
// transparent border keeps the badge the same size as one with a visible border.
type EnvBadgeColors = {
  pointer: string;
  fill: string;
  fillHover: string;
  border: string;
  text: string;
};

type EnvPalette = {
  // The strip along the top of the header. It has the same colour in every mode.
  strip: string;
  standard: EnvBadgeColors;
  contrast: EnvBadgeColors;
  dark: EnvBadgeColors;
};

// Colours per environment, from the design's "Miljøswitch" component. The design
// has no hover colour for dark mode, so the hover colours there are one step lighter
// on the same scale. The design has no colours for local, so they are picked by hand.
// Every text colour has a contrast of at least 4.5:1 on its fill.
const ENV_PALETTES = {
  local: {
    strip: "#B482FB",
    standard: {
      pointer: "#B482FB",
      fill: "#F0E7FF",
      fillHover: "#E0CCFE",
      border: "#B482FB",
      text: semantic.text.accent,
    },
    contrast: {
      pointer: "#B482FB",
      fill: "#B482FB",
      fillHover: "#E0CCFE",
      border: semantic.stroke.colorless,
      text: semantic.text.accent,
    },
    dark: {
      pointer: "#B482FB",
      fill: "#24123F",
      fillHover: "#3D2266",
      border: "#B482FB",
      text: semantic.text.lightalt,
    },
  },
  dev: {
    strip: primitive.mint._60,
    standard: {
      pointer: semantic.stroke.success,
      fill: semantic.fill.success.muted,
      fillHover: semantic.fill.success.tint,
      border: semantic.stroke.success,
      text: semantic.text.accent,
    },
    contrast: {
      pointer: semantic.fill.success.contrast,
      fill: semantic.fill.success.contrast,
      fillHover: semantic.fill.success.tint,
      border: semantic.stroke.colorless,
      text: semantic.text.accent,
    },
    dark: {
      pointer: semantic.stroke.success,
      fill: semantic.fill.success.accent,
      fillHover: primitive.mint._90,
      border: semantic.stroke.success,
      text: semantic.text.lightalt,
    },
  },
  staging: {
    strip: primitive.canary._60,
    standard: {
      pointer: semantic.stroke.warning,
      fill: semantic.fill.warning.muted,
      fillHover: semantic.fill.warning.tint,
      border: semantic.stroke.warning,
      text: semantic.text.accent,
    },
    contrast: {
      pointer: semantic.fill.warning.contrast,
      fill: semantic.fill.warning.contrast,
      fillHover: semantic.fill.warning.tint,
      border: semantic.stroke.colorless,
      text: semantic.text.accent,
    },
    dark: {
      pointer: semantic.stroke.warning,
      fill: semantic.fill.warning.accent,
      fillHover: primitive.canary._90,
      border: semantic.stroke.warning,
      text: semantic.text.lightalt,
    },
  },
  // Production has no pointer, so its pointer colour is never shown.
  production: {
    strip: primitive.blue._60,
    standard: {
      pointer: semantic.stroke.subdued,
      fill: secondaryButton.standard.default,
      fillHover: secondaryButton.standard.hover,
      border: semantic.stroke.subdued,
      text: semantic.text.accent,
    },
    contrast: {
      pointer: semantic.stroke.subdued,
      fill: secondaryButton.contrast.default,
      fillHover: secondaryButton.contrast.hover,
      border: semantic.stroke.subdued,
      text: semantic.text.light,
    },
    dark: {
      pointer: semantic.stroke.subdued,
      fill: secondaryButton.standard.default,
      fillHover: darkSecondaryButton.standard.hover,
      border: semantic.stroke.subdued,
      text: semantic.text.lightalt,
    },
  },
} satisfies Record<Environment, EnvPalette>;

/** Returns the CSS variables for the environment badge in one colour mode. */
const envBadgeVars = (c: EnvBadgeColors): string => `  --uniformen-color-env-pointer: ${c.pointer};
  --uniformen-color-env-fill: ${c.fill};
  --uniformen-color-env-fill-hover: ${c.fillHover};
  --uniformen-color-env-border: ${c.border};
  --uniformen-color-env-text: ${c.text};
`;

/**
 * Returns the badge colours for contrast mode and dark mode, for one environment.
 * The dark selector has two parts, so it wins over `.uniformen-contrast`. A contrast
 * header in dark mode gets the dark colours, as in the design.
 */
export function buildEnvModeVars(env: Environment): string {
  const palette = ENV_PALETTES[env];
  return `.uniformen-contrast {
${envBadgeVars(palette.contrast)}}

[data-color-mode="dark"] .uniformen-top-nav {
${envBadgeVars(palette.dark)}}
`;
}

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
  --uniformen-color-menu-hover: ${sideNavigation.standard.fill.hover};
  --uniformen-color-env: ${palette.strip};
${envBadgeVars(palette.standard)}  --uniformen-env-strip-height: ${envStripHeight(env)};
  --uniformen-space-xs2: ${rem(space.rem.extraSmall2)};
  --uniformen-space-xs: ${rem(space.rem.extraSmall)};
  --uniformen-space-small: ${rem(space.rem.small)};
  --uniformen-space-medium: ${rem(space.rem.medium)};
  --uniformen-space-large: ${rem(space.rem.large)};
  --uniformen-font-xs: ${rem(fontSizes.rem.extraSmall)};
  --uniformen-font-sm: ${rem(fontSizes.rem.small)};
  --uniformen-font-md: ${rem(fontSizes.rem.medium)};
  --uniformen-font-lg: ${rem(fontSizes.rem.large)};
  --uniformen-font-xl: ${rem(fontSizes.rem.extraLarge)};
  --uniformen-font-xl2: ${rem(fontSizes.rem.extraLarge2)};
  --uniformen-line-xs: ${rem(lineHeights.rem.extraSmall)};
  --uniformen-line-md: ${rem(lineHeights.rem.medium)};
  --uniformen-line-xl: ${rem(lineHeights.rem.extraLarge)};
  --uniformen-weight-body: ${fontWeights.body};
  --uniformen-weight-heading: ${fontWeights.heading};
  --uniformen-radius-md: ${rem(borderRadiuses.rem.medium)};
  --uniformen-shadow-focus: ${shadows.focus};
  --uniformen-z-popover: ${zIndexes.popover};
  --uniformen-secondary: ${secondaryButton.standard.default};
  --uniformen-secondary-hover: ${secondaryButton.standard.hover};
  --uniformen-secondary-active: ${secondaryButton.standard.active};
  --uniformen-secondary-border: ${secondaryButton.standard.border};
  --uniformen-secondary-border-active: ${secondaryButton.standard.borderActive};
  --uniformen-on-secondary: ${secondaryButton.standard.text};
  --uniformen-on-secondary-active: ${secondaryButton.standard.textActive};
  --uniformen-icon-button-hover: ${iconButton.standard.hover};
  --uniformen-icon-button-active: ${iconButton.standard.active};
  --uniformen-on-icon-button-active: ${iconButton.standard.iconActive};
  --uniformen-drawer: ${drawer.standard.background};
  --uniformen-on-drawer: ${drawer.standard.text};
  --uniformen-form-fill: ${form.standard.fillDefault};
  --uniformen-form-border: ${form.standard.borderDefault};
  --uniformen-form-border-interactive: ${form.standard.borderInteractive};
  --uniformen-form-label: ${form.standard.textLabel};
  --uniformen-form-text: ${form.standard.textContent};
  --uniformen-floating: ${floatingButton.standard.default};
  --uniformen-floating-hover: ${floatingButton.standard.hover};
  --uniformen-floating-active: ${floatingButton.standard.active};
  --uniformen-on-floating: ${floatingButton.standard.icon};
  --uniformen-shadow-floating: ${shadows.boxShadow};
  --uniformen-chat-agent: ${primitive.lavender._10};
  --uniformen-chat-user: ${data.light.contrast.peach};
  /* Text in the chat window. The window and the bubbles are light in both modes,
     so this colour is not changed in contrast mode. */
  --uniformen-on-chat: ${drawer.standard.text};
}
`;
}

// The panels that open from the bar, and the chat drawer. In contrast mode they keep
// the light colours. See `CONTRAST_VARS`.
const PANELS = [
  ".uniformen-env-switcher__panel",
  ".uniformen-app-switcher__panel",
  ".uniformen-user-menu__panel",
  ".uniformen-locale-switcher__panel",
  ".uniformen-notifications-menu__surface",
  ".uniformen-chat-drawer",
].join(", ");

/**
 * Colours for contrast mode, for a navy bar. They are set on the modifier class, not
 * on `:root`, so they only apply inside a contrast header and footer. All values are
 * the design system's `contrast` variants.
 *
 * The panels and the chat drawer look the same as in light mode. The variables that
 * only panels use are not set here, so the panels get the `:root` values. The second
 * rule sets the variables that both the bar and the panels use back to the light
 * values inside the panels. It also sets the text colour again, because text without
 * its own colour inherits the white text colour of the bar.
 *
 * The environment badge gets its contrast colours from `buildEnvModeVars`.
 */
const CONTRAST_VARS = `.uniformen-contrast {
  --uniformen-surface: ${semantic.fill.background.contrast.lightalt2};
  --uniformen-surface-hover: ${semantic.fill.background.contrast.lightalt};
  --uniformen-surface-active: ${semantic.fill.selected.hover.contrast};
  --uniformen-on-surface: ${semantic.text.light};
  --uniformen-divider: ${semantic.fill.selected.hover.contrast};
  --uniformen-shadow-bar: ${shadows.boxShadowContrast};
  --uniformen-shadow-focus: ${shadows.focusContrast};
  --uniformen-secondary: ${secondaryButton.contrast.default};
  --uniformen-secondary-hover: ${secondaryButton.contrast.hover};
  --uniformen-secondary-active: ${secondaryButton.contrast.active};
  --uniformen-secondary-border: ${secondaryButton.contrast.border};
  --uniformen-secondary-border-active: ${secondaryButton.contrast.borderActive};
  --uniformen-on-secondary: ${secondaryButton.contrast.text};
  --uniformen-on-secondary-active: ${secondaryButton.contrast.textActive};
}

.uniformen-contrast :is(${PANELS}) {
  color: var(--uniformen-on-surface);
  --uniformen-on-surface: var(--uniformen-color-brand-blue);
  --uniformen-surface-hover: var(--uniformen-color-blue-20);
  --uniformen-surface-active: var(--uniformen-color-brand-lavender);
  --uniformen-shadow-focus: ${shadows.focus};
  --uniformen-secondary: ${secondaryButton.standard.default};
  --uniformen-secondary-hover: ${secondaryButton.standard.hover};
  --uniformen-secondary-active: ${secondaryButton.standard.active};
  --uniformen-secondary-border: ${secondaryButton.standard.border};
  --uniformen-secondary-border-active: ${secondaryButton.standard.borderActive};
  --uniformen-on-secondary: ${secondaryButton.standard.text};
  --uniformen-on-secondary-active: ${secondaryButton.standard.textActive};
}
`;

const topbarDark = componentColors.dark.components.menu.topbar.contrast;

/**
 * Colours for dark mode. The app turns dark mode on with `data-color-mode="dark"` on
 * `<html>` or another ancestor, the same attribute the design system's components use.
 * The bar uses the design system's dark top bar colours, and the panels use its dark
 * overlay colours.
 *
 * In the design system, the standard and the contrast colours have the same dark
 * colours. So the first rule also applies to a contrast header and footer. The selector
 * has two parts, so it is more specific than `.uniformen-contrast` and wins over it.
 * The rule also sets the colours on the panels. Contrast mode sets light colours on
 * them with a selector of the same specificity, and this rule comes later, so it wins.
 *
 * The last two rules are exceptions for the chat-drawer.
 */
const DARK_VARS = `[data-color-mode="dark"] :is(.uniformen-top-nav, .uniformen-footer, ${PANELS}) {
  color-scheme: dark;
  --uniformen-surface: ${topbarDark.background};
  --uniformen-surface-hover: ${topbarDark.fillHover};
  --uniformen-surface-active: ${semantic.fill.selected.hover.dark};
  --uniformen-on-surface: ${topbarDark.text};
  --uniformen-divider: ${topbarDark.divide};
  --uniformen-panel: ${semantic.fill.background.overlay.solid};
  --uniformen-panel-body: ${semantic.fill.background.subdued.dark};
  --uniformen-panel-hover: ${semantic.fill.background.overlay.solidalt};
  --uniformen-panel-selected: ${semantic.fill.selected.default.darktint};
  --uniformen-panel-border: ${semantic.fill.selected.hover.darktint};
  --uniformen-panel-border-strong: ${semantic.stroke.darkalt};
  --uniformen-on-panel: ${semantic.text.lightalt};
  --uniformen-on-panel-subdued: ${semantic.text.darkalt};
  --uniformen-shadow-bar: none;
  --uniformen-shadow-panel: ${shadows.boxShadow};
  --uniformen-shadow-focus: ${shadows.focusContrast};
  --uniformen-secondary: ${darkSecondaryButton.standard.default};
  --uniformen-secondary-hover: ${darkSecondaryButton.standard.hover};
  --uniformen-secondary-active: ${darkSecondaryButton.standard.active};
  --uniformen-secondary-border: ${darkSecondaryButton.standard.border};
  --uniformen-secondary-border-active: ${darkSecondaryButton.standard.borderActive};
  --uniformen-on-secondary: ${darkSecondaryButton.standard.text};
  --uniformen-on-secondary-active: ${darkSecondaryButton.standard.textActive};
  --uniformen-icon-button-hover: ${darkIconButton.standard.hover};
  --uniformen-icon-button-active: ${darkIconButton.standard.active};
  --uniformen-on-icon-button-active: ${darkIconButton.standard.iconActive};
  --uniformen-drawer: ${darkDrawer.standard.background};
  --uniformen-on-drawer: ${darkDrawer.standard.text};
  --uniformen-form-fill: ${darkForm.standard.fillDefault};
  --uniformen-form-border: ${darkForm.standard.borderDefault};
  --uniformen-form-border-interactive: ${darkForm.standard.borderInteractive};
  --uniformen-form-label: ${darkForm.standard.textLabel};
  --uniformen-form-text: ${darkForm.standard.textContent};
  --uniformen-floating: ${darkFloatingButton.standard.default};
  --uniformen-floating-hover: ${darkFloatingButton.standard.hover};
  --uniformen-floating-active: ${darkFloatingButton.standard.active};
  --uniformen-on-floating: ${darkFloatingButton.standard.icon};
  --uniformen-shadow-floating: ${shadows.boxShadow};
}

[data-color-mode="dark"] .uniformen-chat-window {
  color-scheme: light;
  --uniformen-form-fill: ${form.standard.fillDefault};
  --uniformen-secondary-border: ${secondaryButton.standard.border};
  --uniformen-secondary-hover: ${secondaryButton.standard.hover};
  --uniformen-on-secondary: ${secondaryButton.standard.text};
  --uniformen-shadow-focus: ${shadows.focus};
}

[data-color-mode="dark"] .uniformen-top-nav .uniformen-new-chat-button {
  --uniformen-secondary: ${darkSecondaryButton.standard.default};
  --uniformen-on-secondary: ${darkSecondaryButton.standard.text};
}
`;

// Built once at startup, for the environment this instance runs in.
const UNIFORMEN_CSS =
  buildRootVars(environment).trim() +
  uniformenCss.trim() +
  CONTRAST_VARS +
  DARK_VARS +
  buildEnvModeVars(environment);

export const uniformenCssHash = await sha256Source(UNIFORMEN_CSS);

export const renderUniformenStyleTag = () => {
  return `<style>${UNIFORMEN_CSS}</style>` as const;
};
