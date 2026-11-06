/**
 * Sidebar toggle icon. It is a rounded frame with a line inside it. It uses the same
 * 20x20 frame as the other top bar icons. The outer edge of the stroke is 20 wide,
 * so the icon uses the full width of the frame.
 *
 * The icon has a line for each sidebar state. CSS shows the one that matches
 * `data-uniformen-sidebar` on the root element. See `uniformen.css`.
 */
export const SidebarToggleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="0.75" y="3.75" width="18.5" height="12.5" rx="2.5" />
      {/* Shown while expanded. It is a short line near the left edge. */}
      <path class="uniformen-sidebar-toggle__line--expanded" d="M4.25 7v6" />
      {/* Shown while collapsed. It is a line from top to bottom that divides the frame. */}
      <path class="uniformen-sidebar-toggle__line--collapsed" d="M7.25 3.75v12.5" />
    </g>
  </svg>
);
