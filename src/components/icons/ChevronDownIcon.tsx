/**
 * Down chevron shown next to a chip's text. It uses the same 20x20 frame as the
 * other top bar icons, but is 1rem in size so it looks like part of the text and
 * not like a separate control. CSS rotates it when the panel is open, so it always
 * points down here.
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
