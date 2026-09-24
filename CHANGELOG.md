# Changelog — Uniformen service

This file lists changes to what the running service renders: the header and footer
markup, their styles and their behaviour.

Apps do not install these changes. Every app that fetches the layout gets them on its
next request, whatever version of [`@entur/uniformen`](./packages/uniformen) it uses.
That is why entries have dates instead of version numbers. Changes to the package's
API are listed in [its own changelog](./packages/uniformen/CHANGELOG.md).

## 2026-09-24

### Fixed

- `app=bedrift` points the logo at `/bedrift` rather than the root of its host.

## 2026-09-23

### Added

- `app=bedrift` now renders Bedrift beside the logo.

## 2026-09-22

### Added

- `contrast=true` paints the top bar in the design system's contrast palette — the
  on-dark variant, the one `@entur/layout`'s `Contrast` puts its children on — for an
  app whose page behind the header is dark. The panels come with it.

## 2026-09-21

### Fixed

- The language options carry their roving `tabindex` as rendered — `0` on the current
  language, `-1` on the rest — instead of getting it from the inline script after
  parse. A React app hydrating the header found three attributes its own tree did not
  have and logged a hydration mismatch on every load. Keyboard behaviour is unchanged.

## 2026-09-14

### Changed

- The user menu's "Logg ut" row points where the new `logoutUrl` parameter says, and
  renders only when it is sent. There is no hardcoded `/auth/logout` any more. It
  takes a path on the consumer's own origin only, like `loginUrl`. An absolute URL,
  `//host` or `javascript:` is not allowed.

## 2026-09-04

### Changed

- The anonymous bar's login link points where the new `loginUrl` parameter says, and
  renders only when it is sent. There is no hardcoded `/auth/login` any more. It
  takes a path on the consumer's own origin only. An absolute URL, `//host` or
  `javascript:` is not allowed.

## 2026-08-18

### Changed

The "Varlser" / "Notifications" button is now hidden, as it is not yet ready for production.

## 2026-08-17

### Added

- `app=skoleskyss` renders Skoleskyss beside the logo. It is not an entry in the app switcher.
- The environment switcher offers the environments the named application is deployed to, not always all three environments.

## 2026-08-13

### Added

- The preview page renders its parameters as a form, so they can be found by opening
  the page instead of by knowing them already. Laid out like the bar — what moves its
  left end on the left, its right end on the right, what belongs to neither below
  both. A plain GET form back to the page, and a change applies itself: a box or a
  menu on the pick, a text field once you leave it. The URL it navigates to is the whole result, and the page prints that URL —
  validated, so unknown parameters and defaults drop out — with a button to copy it.
  Production gets no `debug` controls, which it ignores anyway. Nothing about the
  header or footer changes.

## 2026-08-12

### Changed

- The environment badge, and the switcher `app` turns it into, render only for users
  in the Entur organisation. Every other bar — another organisation's, and the
  anonymous one — loses the chip beside the logo and the pointer above it. Nothing to
  send: the service reads the organisation off the token it is given, and a userinfo
  lookup that fails renders the bar without the badge. The coloured strip along the
  top is untouched, in local, dev and staging as before: it warns whoever is looking
  at the page, and production has none.

## 2026-08-11

### Changed

- Every panel in the top bar — app switcher, environment switcher, user menu,
  language switcher — answers the keyboard the same way. Opening one moves focus
  into it, Up and Down step through its rows and wrap, Home and End jump to the
  ends, Escape closes it and hands focus back to the chip, and tabbing out of it
  closes it rather than leaving it open behind the focus. The language options are
  one tab stop between them instead of one each, which is what their
  `menuitemradio` roles said all along.
- The app switcher renders for signed-in users only: every application it lists is
  behind a login. The anonymous bar loses it, and the divider in front of it. The
  rest of that bar is unchanged.

### Removed

- The app switcher's favourites row, and the "Alle tjenester" heading it stood
  against. Five applications are one list under the panel's title.

## 2026-08-10 — with 0.8.0

### Added

- An `availableLocales` query param (a repeated key:
  `?availableLocales=nb-NO&availableLocales=en-GB`) renders a language switcher — a
  group of radio items under "Språk / Language", each named in its own language,
  with `locale` checked as rendered. Exactly the tags given, in their order: an app
  that translates two of the three offers two. No param renders no switcher. A
  repeat, an unknown tag, or a list not containing `locale` is a `400`, like any
  other unknown value.
- Picking a language dispatches `uniformen:locale` on `window` and does nothing else:
  no cookie, no storage, no reload, no re-labelling. The consuming app persists the
  choice and reloads — the header is rendered in one language and the app's texts in
  another until it does. Picking the current language dispatches nothing.
- Where the switcher sits follows the bar, and it is never in both places: a section
  of the user menu on a signed-in bar, and its own control — globe plus the current
  language, left of the login link — on the anonymous bar, which has no menu to hold
  it. `simple=true` keeps the language in the menu, unlike the rows it drops. Under
  the mobile breakpoint the chip is the globe alone, with the language in its
  `aria-label`.
- The control names itself in both languages — "Språk / Language" — wherever the
  locale is followed for every other string in the bar. It is the signpost for a user
  who cannot read the language the page came back in, and a Norwegian label is no use
  to them.

## 2026-08-06 — with 0.7.0

### Added

- A `simple` query param (`true`, `false`) hides the app switcher, the notifications
  bell, the sidebar toggle and "Mine tilganger". Left: logo, app name, environment
  badge, and a login link — or the user's name over a logout-only menu. For login,
  error and terms pages. Overrides `sidebar=true`. Footer unchanged.

## 2026-08-03 — with 0.6.0

### Changed

- `/ssr` says how its response may be cached. A request carrying an `Authorization`
  header gets `Cache-Control: private, no-store` — the bar names the signed-in user,
  so that response belongs to the one caller who asked for it. Everything else gets
  `public, max-age=60`, and both carry `Vary: Authorization`. If anything caches the
  layout between the service and your pages, a minute is now the longest a change
  here takes to reach them.

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
