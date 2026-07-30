/**
 * Downward chevron for the environment switcher's chip. Drawn in the same 20x20
 * frame as the top bar's other icons, but at 1rem so it reads as part of the
 * badge's text rather than as a control of its own. The open state rotates it in
 * CSS, so the glyph points down here and nowhere else.
 */
export const ChevronDownIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    width="1rem"
    height="1rem"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 7l6 6 6-6"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="square"
      stroke-linejoin="miter"
    />
  </svg>
);
