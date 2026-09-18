/**
 * Globe for the language switcher. Drawn in the same 20x20 frame as the top bar's
 * other labelled controls, so it lines up with them whatever its glyph measures:
 * a circle inset 2.5 on every side, an equator and the meridians that make it read
 * as a globe rather than as a clock.
 */
export const GlobeIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5" />
    <path d="M2.5 10h15" stroke="currentColor" stroke-width="1.5" />
    <path
      d="M10 2.5c2 2 3 4.6 3 7.5s-1 5.5-3 7.5c-2-2-3-4.6-3-7.5s1-5.5 3-7.5z"
      stroke="currentColor"
      stroke-width="1.5"
    />
  </svg>
);
