/**
 * Sidebar toggle icon. The design is 16x16 with a frame that is 14 wide. The viewBox
 * cuts 1 unit from each side, so the frame uses the full width of the 20x20 frame
 * that the other top bar icons use.
 *
 * The icon has one drawing for each sidebar state. CSS shows the one that matches
 * `data-uniformen-sidebar` on the root element. See `uniformen.css`.
 */
export const SidebarToggleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="1 1 14 14"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Shown while expanded. It is a frame with a short line near the left edge. */}
    <g class="uniformen-sidebar-toggle__line--expanded" fill="currentColor">
      <path d="M4.34961 11H3.15039V5H4.34961V11Z" />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M13.5996 3C14.3726 3 14.9997 3.62647 15 4.39941V11.5996C15 12.3728 14.3728 13 13.5996 13H2.39941C1.62647 12.9997 1 12.3726 1 11.5996V4.39941C1.0003 3.62666 1.62666 3.0003 2.39941 3H13.5996ZM2.39941 4.19922C2.2894 4.19952 2.19952 4.2894 2.19922 4.39941V11.5996C2.19922 11.7099 2.28921 11.7995 2.39941 11.7998H13.5996C13.7101 11.7998 13.7998 11.7101 13.7998 11.5996V4.39941C13.7995 4.28922 13.7099 4.19922 13.5996 4.19922H2.39941Z"
      />
    </g>
    {/* Shown while collapsed. It is a frame divided by a line, with three short
        lines in the left part. */}
    <g class="uniformen-sidebar-toggle__line--collapsed" fill="currentColor">
      <path d="M5 10.5H3V9.5H5V10.5Z" />
      <path d="M5 8.5H3V7.5H5V8.5Z" />
      <path d="M5 6.5H3V5.5H5V6.5Z" />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M13.5996 3C14.3726 3 14.9997 3.62647 15 4.39941V11.5996C15 12.3728 14.3728 13 13.5996 13H2.39941C1.62647 12.9997 1 12.3726 1 11.5996V4.39941C1.0003 3.62666 1.62666 3.0003 2.39941 3H13.5996ZM2.39941 4.19922C2.2894 4.19952 2.19952 4.2894 2.19922 4.39941V11.5996C2.19922 11.7099 2.28921 11.7995 2.39941 11.7998H6V4.19922H2.39941ZM7.19922 11.7998H13.5996C13.7101 11.7998 13.7998 11.7101 13.7998 11.5996V4.39941C13.7995 4.28922 13.7099 4.19922 13.5996 4.19922H7.19922V11.7998Z"
      />
    </g>
  </svg>
);
