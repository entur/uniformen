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

const layout = await fetchUniformenLayout();

export default function app() {
  return html`
    <html>
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

Returns `UniformenLayout | null`. Returns `null` if the request fails.

All options are optional and passed as a single object:

```ts
const layout = await fetchUniformenLayout({
  token, // Auth0 access token; adds the user to the nav
  environment: "dev", // "local" | "dev" | "staging" | "production" (default)
  params: { app: "partner", sidebar: true }, // query params for the SSR endpoint
});
```

`params.app` (`"cleos" | "nplan" | "ops-center" | "partner" | "sorvis"`) names the
portal application asking for the layout: it renders the app
name next to the Entur logo, and marks that application as the current page in the
app switcher. Params with an `undefined` value are omitted from the query string,
and array-valued params serialise as a repeated key (`?key=a&key=b`).
An unknown `app` value is rejected by the service with `400`, so the call
returns `null`.

The app switcher links to the environment you fetched the layout from — a `dev`
layout hands your users the dev instances of the other portal applications, never
production.

`params.sidebar` (`boolean`) renders a collapse control at the far left of the top
bar. Set it only if your app has a side navigation to collapse. Uniformen renders
the button; you render the sidebar. See [Sidebar](#sidebar) for the contract.

The same options apply to `fetchUniformenComponents` below.

### React adapter

```tsx
import { fetchUniformenComponents } from "@entur/uniformen/react";

const { HeadAssets, Header, Footer, Scripts } = await fetchUniformenComponents();

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

If the layout fetch fails, all components render nothing.

The adapter parses the layout HTML into real React elements.

- Place `<HeadAssets />` inside `<head>`.
- Place `<Header />` inside `<body>` before `<main>`.
- If needed, place `<Footer />` inside `<body>` after `<main>`.
- Place `<Scripts />` inside `<body>` as the last element.

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
  setCollapsed((event as CustomEvent<{ collapsed: boolean }>).detail.collapsed);
});
```

Uniformen derives the rest from the attribute: the button's chevron direction (in
CSS, so it differs open and closed with no work from you), its `aria-expanded`, and
persisting the preference to `localStorage` under `uniformen:sidebar`.

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

```sh
bun run build
bun publish
```
