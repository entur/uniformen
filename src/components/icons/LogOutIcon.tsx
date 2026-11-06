/**
 * Log out icon. It uses the same bracket and arrow as `LogInIcon`, so the two icons
 * look alike. The bracket is mirrored to the left side, and the arrow is moved right
 * so it points out of the bracket.
 */
export const LogOutIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(18.7506 1.25) scale(-1 1)">
      <path
        fill="currentColor"
        d="M16.7505 0C17.1643 0.000328842 17.501 0.33573 17.5012 0.749512V16.7493C17.5012 17.1633 17.1644 17.4997 16.7505 17.5H10.7507V15.9998H16.001V1.49902H10.7507V0H16.7505Z"
      />
    </g>
    <g transform="translate(5.2494 1.25)">
      <path
        fill="currentColor"
        d="M13.28 8.22021C13.5728 8.51309 13.5728 8.98691 13.28 9.27979L8.28003 14.2798L7.22046 13.2202L10.9412 9.49951H0V8.00049H10.9412L7.22046 4.27979L8.28003 3.22021L13.28 8.22021Z"
      />
    </g>
  </svg>
);
