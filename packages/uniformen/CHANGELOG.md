# Changelog

All notable changes to `@entur/uniformen`.

## 0.3.0 — 2026-07-28

### Changed

- New top bar design. The header is now white with a coloured environment strip
  along the top (none in production), the Entur logo and app name are rendered
  in brand blue and coral, and the app switcher has moved to the right end of
  the bar. The markup is served by the Uniformen service, so consumers pick this
  up without upgrading the package.

### Added

- `params.sidebar` (`"expanded" | "collapsed"`) renders a side navigation
  collapse control in the top bar, starting in the given state. The button
  dispatches a `uniformen:toggle-sidebar` CustomEvent on `window` with
  `{ collapsed: boolean }`; the consuming app owns the sidebar itself.

## 0.2.0 — 2026-07-28

### Changed

- **Breaking:** `fetchUniformenLayout` and `fetchUniformenComponents` take a single
  options object instead of positional arguments. Before: `fetchUniformenLayout(token, "dev")`, after: `fetchUniformenLayout({ token, environment: "dev" })`.

### Added

- `params` option for query parameters sent to the SSR endpoint. `params.app` (`"partner" | "sorvis" | "cleos"`) renders the app name next to the Entur logo. Array-valued params serialise as a repeated key (`key=a&key=b`).
- `FetchUniformenParams` and `FetchUniformenLayoutProps` types exported from the
  package root.

## 0.1.3 — 2026-06-23

### Fixed

- Restore `fetchUniformenLayout` in the published bundle (#29).

## 0.1.2 — 2026-06-11

### Added

- `environment` argument (`"local" | "dev" | "staging" | "production"`) to select
  the Uniformen host. Defaults to `production` (#25).

## 0.1.1 — 2026-06-11

### Added

- `token` argument, forwarded as a `Bearer` Authorization header so the rendered nav includes the signed-in user. Anonymous requests get a login button (#24).

## 0.1.0 — 2026-06-10

### Added

- Initial release: `fetchUniformenLayout` for the header/footer HTML, head assets, scripts and CSP hashes, plus the `@entur/uniformen/react` adapter (`fetchUniformenComponents`) (#23).
