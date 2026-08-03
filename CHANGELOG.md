# Changelog — Uniformen service

What the running service renders: the header and footer markup, their styles and
their behaviour.

There is nothing to install and no way to stay behind. Every app fetching the layout
gets these on its next request, whatever version of
[`@entur/uniformen`](./packages/uniformen) it has, so entries are dated rather than
versioned. Changes to the package's own API are in
[its changelog](./packages/uniformen/CHANGELOG.md).

## 2026-08-03 — with 0.6.0

### Added

- A `locale` query param (BCP 47: `nb-NO` (default), `nn-NO`, `en-GB`) sets the
  language of every string the service renders, `aria-label`s included. Application
  names and environment labels (`DEV`, `PROD`, …) are untranslated. Tags match
  exactly — `nb` and `nb-no` are a `400`, like any other unknown value, never a
  fallback to bokmål.
- The preview page renders `<html lang>` as the locale it was given. Set the same on
  your own page.

## 2026-07-30

### Added

- The signed-in user's name in the top bar opens a menu. It names the user with
  their email underneath, links to their permissions in Entur Partner ("Mine
  tilganger"), and logs them out. Logging out is a relative `/auth/logout` link.

### Changed

- **Breaking:** the top bar's panels carry namespaced ids. `#app-switcher-panel` is
  now `#uniformen-app-switcher-panel`, and `#environment-switcher-panel` is now
  `#uniformen-environment-switcher-panel`. Every id the service renders is prefixed
  now, so none of them can collide with one of yours — but anything reaching for the
  old names, in styles, tests or screenshots, needs the new ones.
- The user's name is a `<button>` rather than a `<span>`, carrying `aria-expanded`
  and `aria-controls` for the menu it opens. Style it off
  `.uniformen-top-nav__user` as before.
- The app switcher and environment switcher toggles carry `aria-haspopup`, so a
  screen reader announces that they open something.

## 2026-07-29 — with 0.4.0 and 0.5.0

The sidebar contract became a single DOM attribute rather than a pair of events plus
a query param, and the app switcher started linking within the environment it is
served from, so a dev layout no longer hands your users production apps. See
[Sidebar](./packages/uniformen/README.md#sidebar) for the whole sidebar contract.

### Changed

- **Breaking:** the sidebar's state is `data-uniformen-sidebar` on `<html>`
  (`"expanded" | "collapsed"`), and it is the only place the state lives. Style your
  sidebar off that selector, and collapse it from anywhere by writing the attribute:
  `document.documentElement.dataset.uniformenSidebar = "collapsed"`. Replaces both
  the `uniformen:set-sidebar` event and the app-side state that had to be kept in
  sync with the button.
- **Breaking:** `uniformen:toggle-sidebar` is now `uniformen:sidebar`, with the same
  `{ collapsed: boolean }` detail. It fires for every change, not just button
  clicks, and is a convenience — the attribute is the contract.
- **Breaking:** the `sidebar` query parameter is whether the app has a sidebar at
  all, not what state it is in. `expanded` / `collapsed` are rejected with `400`.
- **Breaking:** `headAssets` carries an inline `<script>` alongside the styles, and
  it must be in `<head>`. Its hash is in `csp["script-src"]`, which now holds two.
  The whole sidebar lives there rather than in `scripts`: it restores the state
  before the first paint, and it has to be watching the attribute before the app's
  own scripts run, so an early write is announced and persisted like any other.
- The app switcher links to the environment the layout was fetched from, rather than
  always to production.
- The app switcher lists the portal applications ordered by name.
- Nplan and Ops Center are in the app switcher, and can be named beside the logo.
- The collapse button's chevron follows the sidebar state in CSS, so it no longer
  looks the same expanded and collapsed.

### Added

- The collapsed/expanded preference persists in `localStorage` under
  `uniformen:sidebar`, restored before paint. Apps no longer have to store it, and a
  server-rendered app no longer has to guess it.
- An app can pick its own sidebar default by server-rendering
  `<html data-uniformen-sidebar="collapsed">`. The head script only writes the
  attribute when the user has a stored preference, or when nothing has set it at
  all, so a value the app rendered is left alone.
- The `app` parameter marks that application as the current page in the app
  switcher, on top of naming it beside the logo.

### Fixed

- The app switcher highlighted Entur Partner as the current page in every app.

## 2026-07-28 — with 0.2.0 and 0.3.0

### Changed

- New top bar design. The header is white with a coloured environment strip along
  the top (none in production), the Entur logo and app name are rendered in brand
  blue and coral, and the app switcher moved to the right end of the bar.

### Added

- The `sidebar` query parameter renders a side navigation collapse control in the
  top bar. The consuming app owns the sidebar itself.
- The `app` query parameter names the application beside the Entur logo.

## Before that

The layout as of the first release, 2026-06-10: the header and footer, the app
switcher, and the signed-in and anonymous states of the bar. That is the baseline
every entry above changes.
