/**
 * Grid icon for the app switcher. The 3x3 squares are 15x15 in the design, so they
 * are inset 2.5 on every side to be centred in the 20x20 frame. All top bar icons
 * use this frame, so they line up even when their shapes have different sizes.
 */
export const AppGridIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2.5" y="2.5" width="3" height="3" fill="currentColor" />
    <rect x="2.5" y="8.5" width="3" height="3" fill="currentColor" />
    <rect x="2.5" y="14.5" width="3" height="3" fill="currentColor" />
    <rect x="8.5" y="2.5" width="3" height="3" fill="currentColor" />
    <rect x="8.5" y="8.5" width="3" height="3" fill="currentColor" />
    <rect x="8.5" y="14.5" width="3" height="3" fill="currentColor" />
    <rect x="14.5" y="2.5" width="3" height="3" fill="currentColor" />
    <rect x="14.5" y="8.5" width="3" height="3" fill="currentColor" />
    <rect x="14.5" y="14.5" width="3" height="3" fill="currentColor" />
  </svg>
);
