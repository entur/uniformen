# @entur/uniformen

Client library for the Uniformen layout service. It fetches the shared header, footer and head assets from Uniformen, and it provides React components that render them in your app.

The service renders the layout, so changes to the header and footer reach your app
without a new release of this package. These changes are listed in
[the service changelog](https://github.com/entur/uniformen/blob/main/CHANGELOG.md).

## What it does

Uniformen is the shared header and footer for Entur's portal applications. This package fetches the SSR layout from the Uniformen service and gives you typed data and React components to add it to your application.

The fetched layout contains:

- **`headerHtml`** — rendered HTML for the top navigation
- **`footerHtml`** — rendered HTML for the footer
- **`headAssets`** — raw HTML (`<link>`/`<style>` tags) to add to `<head>`
- **`scripts`** — raw `<script>` HTML to add before `</body>`
- **`csp`** — CSP sources per directive (for example `{ "style-src": [...], "script-src": [...] }`) to merge into the Content-Security-Policy header of your page

## Installation

```sh
npm install @entur/uniformen
# or
bun add @entur/uniformen
```

The package needs React 18 or later as a peer dependency.

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

Pass the options as one object:

```ts
const layout = await fetchUniformenLayout({
  token, // Auth0 access token; adds the user to the nav
  environment: "dev", // "local" | "dev" | "staging" | "production" (default)
  params: { app: "partner", sidebar: true, locale: "nb-NO" }, // query params for the SSR endpoint
  timeoutMs: 5000, // how long to wait for the service (default)
});
```

`timeoutMs` (`number`, default `5000`) is how many milliseconds to wait for the
service. When the timeout is reached, the call returns `null`, like it does for every
other failure. Your page can then render without the header and footer instead of
waiting for them.

`params.app` (`"bedrift" | "cleos" | "nplan" | "ops-center" | "partner" | "skoleskyss" | "sorvis"`)
is the portal application that asks for the layout. The top bar shows the app name
next to the Entur logo. The app switcher marks this application as the current one,
unless the application is unlisted. An unknown value makes the service answer `400`,
and the call returns `null`.

Params with an `undefined` value are left out of the query string. Array params are
sent as a repeated key (`?key=a&key=b`).

The app switcher is only shown to signed-in users. It links to the other portal
applications in the environment you fetched the layout from. For example, a `dev`
layout links to the dev instances, never to production.

The environment badge next to the logo is only shown to users in the Entur
organisation. You do not need to send anything for this, because the service reads
it from the token you pass. Other users see the top bar without the badge, but they
still see the colored strip along the top that shows the page is not production.
When `app` is set and your application is deployed in the environment the layout
comes from, the badge is a button. It opens a list of links to your application in
each environment it is deployed to. Otherwise the badge is a plain label.

`params.sidebar` (`boolean`, default `false`) shows a collapse button at the far
left of the top bar. Only set it if your app has a side navigation. Uniformen renders
the button, and your app renders the sidebar. See [Sidebar](#sidebar) for details.

`params.simple` (`boolean`, default `false`) hides the app switcher, notifications,
the sidebar button and "Mine tilganger". The top bar then shows the logo, the app
name and the login link from `params.loginUrl`, or the user's name with a menu that
only has the `params.logoutUrl` row. It overrides `params.sidebar`. The footer does
not change.

`params.loginUrl` (`string`) is the path the "Logg inn" link in the top bar points
to when no `token` is passed. If you leave it out, no login link is shown. It must be
a path on your own origin. An absolute URL, `//host` or `javascript:` makes the
service answer `400`, and the call returns `null`.

`params.logoutUrl` (`string`) is the path the "Logg ut" row in the user menu points
to when a `token` is passed. If you leave it out, no logout row is shown. It must be
a path on your own origin. An absolute URL, `//host` or `javascript:` makes the
service answer `400`, and the call returns `null`.

`params.locale` (BCP 47: `"nb-NO" | "nn-NO" | "en-GB"`, default `"nb-NO"`) is the
language of the header and footer. App names and environment labels are not
translated. The tag must match exactly. For example, `"nb"` makes the service answer
`400`. Set `<html lang>` to the same value.

`params.availableLocales` (`Locale[]`) shows a language switcher with exactly these
tags, in this order. If you leave it out or pass an empty list, no switcher is shown.
See [Language](#language) for where it is shown and which values are accepted.

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

`csp` is the same `Record<string, string[]>` that `fetchUniformenLayout` returns, so
you only need one fetch to set a `Content-Security-Policy` header. Merge these
sources into your own directives.

- Place `<HeadAssets />` inside `<head>`.
- Place `<Header />` inside `<body>` before `<main>`.
- If needed, place `<Footer />` inside `<body>` after `<main>`.
- Place `<Scripts />` inside `<body>` as the last element.

### Using with Next.js

With Next.js, pass `Script` as the `loader` prop to `<HeadAssets>` and `<Scripts>`.
Otherwise Next.js can change the order in which scripts run, so scripts and components load in the wrong order.

```tsx
import Script from "next/script";

// The head script sets the sidebar state before the first paint, so it must be in
// the initial HTML. The default Next.js strategy adds scripts after hydration, and
// the user would see the sidebar jump.
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

Pass `params.sidebar: true` to show a collapse button at the far left of the top
bar. Uniformen does not render the sidebar itself.

The state is stored only in this attribute on the root element:

```html
<html data-uniformen-sidebar="expanded | collapsed"></html>
```

The sidebar code is in `headAssets`, so `<HeadAssets />` must be in `<head>`. It
sets the stored state before the first paint, so a collapsed sidebar does not jump.
It also starts watching the attribute before your own scripts run, so it sees every
write to the attribute, even early ones.

**Style your sidebar based on the attribute.** Then you need no JavaScript state,
and the sidebar is correct on the first frame. This also works in a server-rendered
app, where the server does not know the user's preference:

```css
:root[data-uniformen-sidebar="collapsed"] .my-sidebar {
  width: 0;
  /* Also hide it from screen readers and the tab order. With only width: 0, the
     links can still get focus and screen readers still read them. */
  visibility: hidden;
}
```

If the collapse is animated, add a transition on `visibility` together with the
width (`transition: width 150ms ease, visibility 150ms ease`). Then the content stays
visible until the animation has finished.

**To use a different default**, render `<html data-uniformen-sidebar="collapsed">` on
the server. Uniformen only writes the attribute when the user has a stored
preference or when the attribute is not set, so your value is kept.

Uniformen treats the value you render as the start state, not as a change. It is
not saved to `localStorage`, and no `uniformen:sidebar` event fires for it. When the
user collapses or expands the sidebar for the first time, that choice _is_ saved,
and from then on it is used instead of the default you render. If your app stores
the preference on the server and wants its own value to be used, clear the
`uniformen:sidebar` key when it saves its own copy.

**To collapse it from other places**, for example a close button in the sidebar, a
keyboard shortcut or a route change, write the same attribute. The top bar button
does the same:

```ts
document.documentElement.dataset.uniformenSidebar = "collapsed";
```

**To react to changes in script**, listen for the event. Use the CSS above when you
can. The event fires for every change, from the button or from your app, and has the
new state:

```ts
window.addEventListener("uniformen:sidebar", (event) => {
  setCollapsed(event.detail.collapsed);
});
```

`event.detail` is typed. This event and `uniformen:locale` are declared on
`WindowEventMap`, so in a project that imports from the package, every file gets
them typed without an extra import or a cast.

Uniformen updates the rest from the attribute: the direction of the arrow on the
button, its `aria-expanded`, and the preference it saves to `localStorage` under
`uniformen:sidebar`.

## Language

`params.locale` is the language of everything the service renders.
`params.availableLocales` adds a control where the user can change the language:

```ts
const layout = await fetchUniformenLayout({
  token,
  params: { app: "partner", locale, availableLocales: ["nb-NO", "en-GB"] },
});
```

The languages are a group of radio items. The server renders `locale` as the
selected one, so there is no client state and the label is right from the start.
Each language is named in its own language ("Norsk bokmål", "English"). The control
is always labelled "Språk / Language", whatever `locale` is, so users can find it
even if they cannot read the current language.

**Where the control is shown depends on the top bar.** It is only shown in one
place:

- When a user is signed in, it is a "Språk / Language" section in the user menu,
  above the logout row. It stays there when `params.simple` is set.
- On the anonymous top bar, which has no menu, it is a separate control to the left
  of the login link. It shows a globe and the current language. On small screens
  the text is hidden, and the globe has an `aria-label` with the language name.

Only list the tags your own app is translated into. Uniformen supports three, but
offering a language your pages do not have is worse than not offering it. You choose
the order. If the list has a repeated tag, an unknown tag or does not contain
`locale`, the service answers `400` and the call returns `null`.

**Your app must handle the choice.** When the user picks a language, the top bar
dispatches one event and does nothing else. It does not set a cookie, write to
`localStorage`, reload or change the labels in the bar:

```ts
window.addEventListener("uniformen:locale", (event) => {
  const { locale } = event.detail;
  // persist however your app persists it, then:
  window.location.reload();
});
```

The reload changes the language. The server renders the header in one language,
and your own texts are loaded when your modules load. If the top bar changed its
labels without a reload, the rest of the page would still be in the old language.

On the next render, send the stored choice as `params.locale` and set `<html lang>`
to the same value. For example, your server reads a cookie, sends its value as
`locale`, and one event listener writes the cookie.

If the user picks the language that is already shown, no event is dispatched, so the
page does not reload.

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

release-please creates all releases. Do not release by hand: do not run
`bun publish` or `npm publish` locally, and do not edit `version` in `package.json`
or [CHANGELOG.md](CHANGELOG.md).

On every push to `main`, release-please collects the commits that change
`packages/uniformen/`. It keeps a release pull request open with the next version and
the generated changelog. When you merge it, the release is tagged, and the
[Release workflow](../../.github/workflows/release.yml) builds, tests and publishes
`@entur/uniformen` to npm.

The version is based on the commit subjects, so they must use
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
