# Changelog

All notable changes to `@entur/uniformen`.

The header and footer are rendered by the Uniformen service rather than by the
package, and changes to that markup reach every app on its next request, whatever
version it has installed. Those are dated rather than versioned, and listed in
[the service changelog](https://github.com/entur/uniformen/blob/main/CHANGELOG.md).

## 0.6.0 — 2026-08-03

The header and footer can be asked for in nynorsk or English.

### Added

- `params.locale` (BCP 47: `"nb-NO" | "nn-NO" | "en-GB"`, default `"nb-NO"`) sets the
  language of the header and footer. Tags match exactly; an unknown value is rejected
  by the service with `400`, so the call returns `null`.
- The `Locale` type is exported.

## 0.5.0 — 2026-07-29

The app switcher now links within the environment it is served from, so a dev
layout no longer hands your users production apps.

### Added

- `params.app` accepts `"nplan"` and `"ops-center"` alongside `"cleos"`,
  `"partner"` and `"sorvis"`.
- `params.app` also marks your application as the current page in the app switcher,
  on top of naming it beside the logo.

### Changed

- The app switcher links to the environment the layout was fetched from, rather
  than always to production.
- The switcher lists the portal applications ordered by name.

### Fixed

- The app switcher highlighted Entur Partner as the current page in every app.

## 0.4.0 — 2026-07-29

The sidebar contract is now a single DOM attribute rather than a pair of events
plus a query param. Most of it is served by the Uniformen service, so apps on
0.3.0 pick up the new behaviour on their next request — including the changes that
break them. See [Sidebar](./README.md#sidebar) for the whole contract.

### Changed

- **Breaking:** `params.sidebar` is a `boolean` — whether the app has a sidebar at
  all. It no longer carries the state, which was never something a server render
  could know. `"expanded"` / `"collapsed"` are rejected with `400`, so
  `fetchUniformenLayout` returns `null`.
- **Breaking:** the sidebar's state is `data-uniformen-sidebar` on `<html>`
  (`"expanded" | "collapsed"`), and it is the only place the state lives. Style your
  sidebar off that selector, and collapse it from anywhere by writing the
  attribute: `document.documentElement.dataset.uniformenSidebar = "collapsed"`.
  Replaces both the `uniformen:set-sidebar` event and the app-side state that had to
  be kept in sync with the button.
- **Breaking:** `uniformen:toggle-sidebar` is now `uniformen:sidebar`, with the
  same `{ collapsed: boolean }` detail. It fires for every change, not just button
  clicks, and is a convenience — the attribute is the contract.
- The collapse button's chevron follows the state in CSS, so it no longer looks the
  same expanded and collapsed.
- `headAssets` now contains an inline `<script>` alongside the styles, and it must be
  in `<head>`. Its hash is included in `csp["script-src"]` (that directive now
  carries two hashes). The whole sidebar lives there rather than in `scripts`: it
  restores the state before the first paint, and it has to be watching the attribute
  before the app's own scripts run, so that an early write is announced and persisted
  like any other.

### Added

- The collapsed/expanded preference persists in `localStorage` under
  `uniformen:sidebar`, restored before paint. Apps no longer have to store it, and
  a server-rendered app no longer has to guess it.
- An app can pick its own default by server-rendering
  `<html data-uniformen-sidebar="collapsed">`. The head script only writes the
  attribute when the user has a stored preference, or when nothing has set it at all,
  so a value the app rendered is left alone.

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
