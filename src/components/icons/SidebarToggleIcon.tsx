/**
 * Sidebar toggle icon. It is a frame with a vertical line and a chevron next to it.
 * The paths are copied unchanged from the Figma export. The `translate` moves them
 * so the viewBox starts at 0, with the stroke width inside the bounds.
 *
 * The icon has both chevron directions. CSS shows the one that matches
 * `data-uniformen-sidebar` on the root element. See `uniformen.css`.
 */
export const SidebarToggleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 17.52 12.51"
    width="1.095em"
    height="0.782em"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      transform="translate(-39.25 -29.78)"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <path d="M40 41.5395V30.5312H56.02V41.5395H40Z" />
      <path d="M52.3848 30.1172V41.6376" />
      {/* Shown while expanded. It points at the line, which means "collapse". */}
      <path
        class="uniformen-sidebar-toggle__chevron--collapse"
        d="M47.957 38.3516L45.5768 35.9713L47.957 33.5911"
      />
      {/* Shown while collapsed. It is the same chevron mirrored, which means "expand". */}
      <path
        class="uniformen-sidebar-toggle__chevron--expand"
        d="M45.5768 38.3516L47.957 35.9713L45.5768 33.5911"
      />
    </g>
  </svg>
);
