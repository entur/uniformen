/**
 * App switcher grid. The 3x3 field of squares is 15x15 in the design, centred
 * in the shared 20x20 icon frame — hence the 2.5 inset on every side. Every
 * icon in the top bar's labelled controls uses that frame, so they line up
 * whatever their glyph measures.
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
