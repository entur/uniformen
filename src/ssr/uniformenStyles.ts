import {
  borderRadiuses,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  shadows,
  space,
  zIndexes,
} from "@entur/tokens";
import uniformenCss from "./uniformen.css" with { type: "text" };
import { sha256Source } from "./sha256";

// @entur/tokens *.rem fields are unitless numbers (px/16). Append the unit here.
const rem = (n: number) => `${n}rem`;

const rootVars = `:root {
  --uniformen-color-brand-blue: ${colors.brand.blue};
  --uniformen-color-brand-coral: ${colors.brand.coral};
  --uniformen-color-brand-white: ${colors.brand.white};
  --uniformen-color-brand-lavender: ${colors.brand.lavender};
  --uniformen-color-blue-10: ${colors.blues.blue10};
  --uniformen-color-blue-40: ${colors.blues.blue40};
  --uniformen-color-blue-50: ${colors.blues.blue50};
  --uniformen-color-blue-70: ${colors.blues.blue70};
  --uniformen-color-blue-80: ${colors.blues.blue80};
  --uniformen-color-blue-90: ${colors.blues.blue90};
  --uniformen-space-xs2: ${rem(space.rem.extraSmall2)};
  --uniformen-space-small: ${rem(space.rem.small)};
  --uniformen-space-medium: ${rem(space.rem.medium)};
  --uniformen-space-large: ${rem(space.rem.large)};
  --uniformen-font-xs: ${rem(fontSizes.rem.extraSmall)};
  --uniformen-font-md: ${rem(fontSizes.rem.medium)};
  --uniformen-font-lg: ${rem(fontSizes.rem.large)};
  --uniformen-line-xs: ${rem(lineHeights.rem.extraSmall)};
  --uniformen-weight-body: ${fontWeights.body};
  --uniformen-weight-heading: ${fontWeights.heading};
  --uniformen-radius-md: ${rem(borderRadiuses.rem.medium)};
  --uniformen-shadow-focus: ${shadows.focus};
  --uniformen-z-popover: ${zIndexes.popover};
}
`;

const UNIFORMEN_CSS = rootVars.trim() + uniformenCss.trim();

export const uniformenCssHash = await sha256Source(UNIFORMEN_CSS);

export const renderUniformenStyleTag = () => {
  return `<style>${UNIFORMEN_CSS}</style>` as const;
};
