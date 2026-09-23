# @entur/uniformen

Client library for consuming the Uniformen layout service. Fetches the shared header, footer, and head assets from Uniformen and provides ready-to-use React components for rendering them in your app.

Because the layout is rendered by the service, changes to the header and footer
reach your app without a release of this package. They are changelogged separately,
in [the service changelog](https://github.com/entur/uniformen/blob/main/CHANGELOG.md).

## What it does

Uniformen is Entur's shared navigation shell. This package fetches the SSR layout from the Uniformen service and gives you typed data and React components to embed it in your application.

The fetched layout contains:

- **`headerHtml`** — rendered HTML for the top navigation
- **`footerHtml`** — rendered HTML for the footer
- **`headAssets`** — raw HTML (`<link>`/`<style>` tags) to inject into `<head>`
- **`scripts`** — raw `<script>` HTML to inject before `</body>`
- **`csp`** — per-directive CSP sources (e.g. `{ "style-src": [...], "script-src": [...] }`) to union into your page's Content-Security-Policy header

## Installation

```sh
npm install @entur/uniformen
# or
bun add @entur/uniformen
```

React 18 or later is required as a peer dependency.

## Usage

### Fetch the layout

```ts
import { fetchUniformenLayout } from "@entur/uniformen";

const layout = await fetchUniformenLayout({
  token, // the signed-in user's Auth0 access token
  environment: "dev", // the Uniformen of the environment this app runs in
  params: {
    app: "partner",
    sidebar: true,
    locale: "nb-NO",
    availableLocales: ["nb-NO", "en-GB"],
    loginUrl: "/auth/login", // where the login link points when there is no token
    logoutUrl: "/auth/logout", // where the user menu's logout row points
  },
});

export default function app() {
  return html`
    <html lang="nb-NO">
      <head>
        ${layout.headAssets}
      </head>
      <body>
        ${layout.headerHtml}
        <main>{/* your app */}</main>
        ${layout.footerHtml}
        ${layout.scripts}
      </body>
    </html>
`;
```

The options are passed as a single object:

```ts
const layout = await fetchUniformenLayout({
  token, // Auth0 access token; adds the user to the nav
  environment: "dev", // "local" | "dev" | "staging" | "production" (default)
  params: { app: "partner", sidebar: true, locale: "nb-NO" }, // query params for the SSR endpoint
  timeoutMs: 5000, // how long to wait for the service (default)
});
```

`timeoutMs` bounds the wait. The layout is fetched on the critical path of a page
render, so a service that goes quiet must not become an app that goes quiet: when the
timeout is reached the call returns `null` — the same answer every other failure
gives — and your page renders without the shared chrome rather than not at all.

`params.app` (`"bedrift" | "cleos" | "nplan" | "ops-center" | "partner" | "skoleskyss" | "sorvis"`)
names the portal application asking for the layout: it renders the app name next to
the Entur logo, and marks that application as the current page in the app switcher if not marked as unlisted.

Params with an `undefined` value are omitted from the query string, and array-valued
params serialise as a repeated key (`?key=a&key=b`). An unknown `app` value is
rejected by the service with `400`, so the call returns `null`.

The app switcher renders for signed-in users only. It links to the environment you
fetched the layout from — a `dev` layout hands your users the dev instances of the
other portal applications, never production.

The environment badge beside the logo, and the switcher `app` turns it into, render
only for users in the Entur organisation. Nothing to send: the service reads it off
the token you pass. Your other users get the bar without it, and keep the coloured
strip along the top that says the page is not production. The switcher offers the
environments your application is deployed to, and none of them is the badge staying
static.

`params.sidebar` (`boolean`) renders a collapse control at the far left of the top
bar. Set it only if your app has a side navigation to collapse. Uniformen renders
the button; you render the sidebar. See [Sidebar](#sidebar) for the contract.

`params.simple` (`boolean`) hides the app switcher, notifications, the sidebar toggle
and "Mine tilganger", leaving logo, app name and the login link `params.loginUrl` asks
for — or the user's name over a menu of the `params.logoutUrl` row alone. Overrides
`params.sidebar`. Footer unchanged.

`params.loginUrl` (`string`) is where the top bar's "Logg inn" link points on a
render with no `token`. Omitted renders no login link. Must be a path on your own origin.

`params.logoutUrl` (`string`) is where the user menu's "Logg ut" row points, on a
render with a `token`. Omitted renders no logout row. Must be a path on your own origin.

`params.locale` (BCP 47: `"nb-NO" | "nn-NO" | "en-GB"`, default `"nb-NO"`) is the
language of the header and footer. App names and environment labels are untranslated.
Tags match exactly — `"nb"` is a `400`, not an alias. Set `<html lang>` to match.

`params.availableLocales` (`Locale[]`) renders a language switcher offering exactly
these tags in this order — in the user menu, or as a control of its own where there
is no menu. Omitted or empty renders none. See [Language](#language) for the
contract.

The same options apply to `fetchUniformenComponents` below.

### React adapter

```tsx
import { fetchUniformenComponents } from "@entur/uniformen/react";

const { HeadAssets, Header, Footer, Scripts, csp } = await fetchUniformenComponents({
  token,
  environment: "dev",
  params: { app: "partner", sidebar: true, locale: "nb-NO" },
});

export default function App() {
  return (
    <>
      <head>
        <HeadAssets />
      </head>
      <body>
        <Header />
        <main>{/* your app */}</main>
        <Footer />
        <Scripts />
      </body>
    </>
  );
}
```

If the layout fetch fails, all components render nothing and `csp` is `{}`.

The adapter parses the layout HTML into real React elements.

`csp` is the same `Record<string, string[]>` `fetchUniformenLayout` returns, handed back
here too so an app that sets a `Content-Security-Policy` header has it from the one
fetch. Union those sources into your own directives.

- Place `<HeadAssets />` inside `<head>`.
- Place `<Header />` inside `<body>` before `<main>`.
- If needed, place `<Footer />` inside `<body>` after `<main>`.
- Place `<Scripts />` inside `<body>` as the last element.

### Using with Next.js

When loading Uniformen with Next.js, pass `Script` as a `loader` prop to `<HeadAssets>` and `<Scripts>`.
Otherwise Next.js can change the execution order, causing scripts and components to get loaded in the wrong order.

```tsx
import Script from "next/script";

// The head script restores the sidebar before the first paint, so it has to be in
// the initial HTML. Next's default strategy injects after hydration, which is a
// visible jump.
const BeforeInteractiveScript: typeof Script = (props) => <Script {...props} strategy="beforeInteractive" />;

<head>
  <HeadAssets loader={BeforeInteractiveScript} />
</head>
<body>
  <Header />
  <main>{/* your app */}</main>
  <Scripts loader={Script} />
</body>;
```

## Sidebar

Pass `params.sidebar: true` and the top bar renders a collapse control at its far
left. Uniformen never renders a sidebar.

The state is one attribute on the root element, and that is the only place it
lives:

```html
<html data-uniformen-sidebar="expanded | collapsed"></html>
```

The whole sidebar ships in `headAssets`, so `<HeadAssets />` has to be in `<head>`.
It restores the stored state before the first paint — a collapsed sidebar paints
collapsed rather than jumping — and it starts watching the attribute before your own
scripts run, so a write from anywhere is picked up, however early.

**Style your sidebar off the attribute.** No JavaScript state, nothing to keep in
sync, and it is correct on the first frame — including in a server-rendered app,
whose server can't know the preference:

```css
:root[data-uniformen-sidebar="collapsed"] .my-sidebar {
  width: 0;
  /* Hide it from the a11y tree and the tab order too. Width alone only hides it
     from the eye: the links stay focusable and announced, so a collapsed sidebar
     becomes a run of invisible tab stops. */
  visibility: hidden;
}
```

If the collapse animates, transition `visibility` alongside the width
(`transition: width 150ms ease, visibility 150ms ease`) so the content stays visible
until the animation has finished.

**To pick a different default**, server-render `<html data-uniformen-sidebar="collapsed">`.
Uniformen only writes the attribute itself when the user has a stored preference, or
when nothing has set it at all, so the value you rendered survives.

A value you rendered is treated as the state the page starts in, not as a change: it
is not copied into `localStorage`, and no `uniformen:sidebar` event fires for it. The
first time the user collapses or expands the sidebar themselves, that choice _is_
stored — and from then on it wins over the default you render. An app that keeps the
preference server-side and wants to stay authoritative should clear the
`uniformen:sidebar` key when it writes its own copy.

**Collapse it from anywhere** — a close button inside the sidebar, a keyboard
shortcut, a route change — by writing the same attribute. That is the whole API;
the top bar button does exactly this:

```ts
document.documentElement.dataset.uniformenSidebar = "collapsed";
```

**React in script** if you need to, though prefer the CSS above. The event fires
for every change, whoever made it, and carries the new state:

```ts
window.addEventListener("uniformen:sidebar", (event) => {
  setCollapsed(event.detail.collapsed);
});
```

`event.detail` is typed — both this event and `uniformen:locale` are declared on
`WindowEventMap`, so any file in a project that imports from the package gets them
checked without an import or a cast of its own.

Uniformen derives the rest from the attribute: the button's chevron direction (in
CSS, so it differs open and closed with no work from you), its `aria-expanded`, and
persisting the preference to `localStorage` under `uniformen:sidebar`.

## Language

`params.locale` is the language everything the service renders is rendered in.
`params.availableLocales` adds the control the user changes it with:

```ts
const layout = await fetchUniformenLayout({
  token,
  params: { app: "partner", locale, availableLocales: ["nb-NO", "en-GB"] },
});
```

The languages are a group of radio items, with `locale` checked as rendered by the
server — no client state and no flash of the wrong label. Each language is named in
itself ("Norsk bokmål", "English"), and the control itself is labelled in both
("Språk / Language") whatever `locale` says — a label you can't read is one you can't
pick your way out of.

**Where the control sits follows the bar**, and it is never in two places at once:

- a signed-in bar has it as a "Språk / Language" section of the user menu, above
  the way out. `params.simple` keeps it there, unlike the links it drops;
- the anonymous bar, which has no menu to hold it, has it as a control of its own,
  left of the login link where there is one, naming the current language beside a
  globe. Under the mobile breakpoint the label goes and the globe keeps an
  `aria-label` naming the language, like the bar's other controls.

List only the tags your own app translates: Uniformen renders three, and offering a
language your pages don't have is worse than not offering it. Order is yours. A
repeat, an unknown tag, or a list that doesn't contain `locale` is a `400`, so the
call returns `null`.

**Uniformen owns the control; you own the choice.** A pick dispatches one event and
does nothing else — no cookie, no `localStorage`, no reload, no re-labelling of the
bar:

```ts
window.addEventListener("uniformen:locale", (event) => {
  const { locale } = event.detail;
  // persist however your app persists it, then:
  window.location.reload();
});
```

The reload is what completes the change, and it is why nothing is applied
optimistically: the header is rendered in one language on the server and your own
texts are resolved when your modules load, so a switched bar over an unswitched page
is the only thing in-place re-labelling could produce.

On the next render, send the stored choice back as `params.locale` and set
`<html lang>` to match. That is the whole loop — a cookie your server reads, `locale`
out of it, one event listener back in.

Picking the language already rendered dispatches nothing, so the page does not reload
for nothing.

## Project structure

```
packages/uniformen/
├── src/
│   ├── index.ts               # Public API: exports fetchUniformenLayout + UniformenLayout type
│   ├── types.ts               # UniformenLayout type definition
│   ├── index.test.ts          # Tests for fetchUniformenLayout
│   ├── reactAdapter.tsx       # React adapter: fetchUniformenComponents
│   └── lib/
│       └── fetchUniformenLayout.ts  # Fetches layout from the Uniformen SSR endpoint
├── dist/                      # Compiled output (generated by bun run build)
├── tsconfig.json              # TypeScript config for type checking and local dev
├── tsconfig.build.json        # TypeScript config for emitting .d.ts declaration files
└── package.json
```

## Building

```sh
bun run build
```

## Publishing

Releases are cut by release-please, never by hand — do not run `bun publish` or
`npm publish` locally, and do not edit `version` in `package.json` or
[CHANGELOG.md](CHANGELOG.md).

On every push to `main`, release-please collects the commits touching
`packages/uniformen/` and keeps a release pull request open with the next version and
the generated changelog. Merging it tags the release and the
[Release workflow](../../.github/workflows/release.yml) builds, tests and publishes
`@entur/uniformen` to npm.

The version comes from the commit subjects, so they use
[Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(uniformen): add loginUrl to the render options
```

| Type                                                  | Effect on the published version |
| ----------------------------------------------------- | ------------------------------- |
| `feat`                                                | Minor bump                      |
| `fix`                                                 | Patch bump                      |
| `feat!`, or any type with a `BREAKING CHANGE:` footer | Major bump                      |
| `chore`, `docs`, `refactor`, `test`, `build`, `ci`    | No release                      |

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full commit and release rules.
