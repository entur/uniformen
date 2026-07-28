# Changelog

All notable changes to `@entur/uniformen`.

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
