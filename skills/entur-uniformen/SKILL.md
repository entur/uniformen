---
name: entur-uniformen
description: Uniformen — the shared header and footer of Entur's B2B and partner-facing portals, served rendered and consumed server-side through the @entur/uniformen package. Use when adding, upgrading or debugging the shared top bar, nav bar, header, footer or app switcher in an Entur portal application; when wiring the sidebar collapse control, the language switcher or the environment badge; when a page's Content-Security-Policy has to admit the shared chrome; when starting a new Entur portal or partner-facing frontend that needs the shared chrome; and whenever fetchUniformenLayout, fetchUniformenComponents, uniformen:sidebar or data-uniformen-sidebar appear in the task.
---

> **Audience:** AI coding agents adding Uniformen to an Entur application. Working on the service itself instead? Read the repository's own README at https://github.com/entur/uniformen.

# Uniformen

Uniformen is Entur's shared navigation shell: one service renders the header and footer, every portal application embeds the same rendered HTML. Changes to the chrome reach your app without a release of your app.

**Who it is for.** Uniformen dresses Entur's B2B portals — the applications Entur's partners and its own organisation sign in to, `partner`, `cleos`, `nplan`, `ops-center`, `skoleskyss` and `sorvis` among them. Those users move between several of these applications, and the shared bar is what makes that one product rather than six: the same header, the same app switcher between them, the same account menu. A public consumer-facing site is a different surface with a different chrome, and it is not what this service renders.

The service exposes `/ssr`, which answers with the layout as JSON. `@entur/uniformen` is the client for that endpoint.

**Server-side rendering only.** Every fetch of the layout happens on the server, during the render of the document — a loader, a server component, a request handler. Two things enforce it: `/ssr` sends no CORS headers, so a browser fetch from your app's origin is blocked, and the call carries the user's Auth0 access token, which is not a thing to hand to the browser. An app that renders entirely in the client has no place to call this from, and its route is to render the shell on the server, however thin that server render is.

**Outside JavaScript.** `@entur/uniformen` is the adapter for the JavaScript and TypeScript ecosystem, and it is the only adapter that exists today. The service itself is language-agnostic: `/ssr` is a plain HTTP endpoint answering JSON, so a server in any language can call it with a bearer token and place the four HTML fields itself, exactly as described below. An app on another stack that wants a real adapter of its own asks for one in **#work-micro-frontend** in Entur's Slack.

**Package README** (the full client API, and the authority when this skill is thinner): https://raw.githubusercontent.com/entur/uniformen/main/packages/uniformen/README.md
**Service README** (`/ssr` parameters, environment badge, preview page): https://raw.githubusercontent.com/entur/uniformen/main/README.md

## Starting a new frontend

A new B2B or partner-facing portal starts from the template, not from an empty Vite app:

```sh
gh repo create entur/<app-name> --template entur/create-entur-frontend --internal
```

https://github.com/entur/create-entur-frontend is a TanStack Start app with the Entur design system, Tailwind, Vitest and Bun, and it has Uniformen wired already: `fetchUniformenComponents` in the root loader (`src/routes/__root.tsx`), options in `config.uniformen` (`src/server/auth/config.ts`), and `ENVIRONMENT` / `UNIFORMEN_APP` as the environment variables behind them. The rest of this skill is then for changing that wiring, not for building it.

Reach for the steps below only when the app already exists and Uniformen has to be added to it.

## Integrating

### Step 1: Install

```sh
npm install @entur/uniformen   # or: bun add @entur/uniformen
```

React 18 or later, as a peer dependency. The package ships two entry points: `@entur/uniformen` for the raw layout, `@entur/uniformen/react` for React components. Pick the React adapter in a React app — it parses the layout into real elements instead of leaving you with `dangerouslySetInnerHTML`.

### Step 2: Pick one entry point

There are two, and they take the same options. Call one of them, not both:

| Entry point                                           | Returns                                                  | Use it when                                                             |
| ----------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `fetchUniformenComponents` (`@entur/uniformen/react`) | `{ HeadAssets, Header, Footer, Scripts, csp }`           | React app. The one to reach for — it parses the HTML into real elements |
| `fetchUniformenLayout` (`@entur/uniformen`)           | `UniformenLayout \| null` — four HTML strings plus `csp` | No React: place the four strings yourself                               |

```ts
import { fetchUniformenLayout } from "@entur/uniformen";

const layout = await fetchUniformenLayout({
  token, // optional; the user's Auth0 access token
  environment: "dev", // "local" | "dev" | "staging" | "production" (default)
  params: {
    app: "partner",
    sidebar: true,
    locale: "nb-NO",
    loginUrl: "/auth/login",
    logoutUrl: "/auth/logout",
  },
  timeoutMs: 5000, // default
});
```

Call this where the document is rendered, on the server. The layout is part of the page's HTML from the first byte, not something the client fetches afterwards.

`token` is what puts the user in the bar. Without it the layout still renders — an anonymous bar, no app switcher and no user menu — so a page rendered before sign-in passes nothing and is not a special case. That bar gets a "Logg inn" link only if you send `params.loginUrl`, a path on your own origin: the service does not guess your login route, and anything but a path is a `400`. The signed-in user menu's "Logg ut" row works the same way, from `params.logoutUrl` — the session is yours to end, so the route is yours to name.

`environment` names which Uniformen the layout comes from, and it must match the environment your app is running in: the app switcher links to the environment you fetched from, so a production layout in dev hands your users production instances of every other portal application.

The `params` are documented as JSDoc on `FetchUniformenParams` — read the type rather than guessing.

### Registering a new app

An application not on that list gets on it by pull request to `entur/uniformen`, and the layout is fetched without `app` until that lands — the bar renders, it just carries no app name, no entry in the switcher and no environment switcher.

The PR adds one entry to `APPLICATIONS` in `src/components/portalApplications.ts`:

```ts
{
  id: "my-app",          // the value apps send as the `app` param
  appName: "My App",     // the name beside the logo and in the switcher
  hosts: {               // an environment left out is one the app is not deployed to
    dev: "my-app.dev.entur.io",
    staging: "my-app.staging.entur.io",
    production: "my-app.entur.io",
  },
},
```

Entries are declared in the order the switcher lists them: alphabetical by `appName` in Norwegian collation, where Ø sorts last. Add `unlisted: true` for an app that should wear the chrome without appearing in other apps' switchers.

The same id then goes into the `app` union of `FetchUniformenParams` in `packages/uniformen/src/types.ts`, and reaches consumers with the next release of the package. Ask in **#work-micro-frontend** if the app's place in the portal is not obvious.

### Step 3: Render all four pieces, in their places

`UniformenLayout` has four HTML fields, and each has one correct home:

| Field        | React component  | Where                                |
| ------------ | ---------------- | ------------------------------------ |
| `headAssets` | `<HeadAssets />` | inside `<head>`                      |
| `headerHtml` | `<Header />`     | inside `<body>`, before `<main>`     |
| `footerHtml` | `<Footer />`     | inside `<body>`, after `<main>`      |
| `scripts`    | `<Scripts />`    | inside `<body>`, as the last element |

The React adapter takes the same options as `fetchUniformenLayout` — pass them, all of them. Calling it bare defaults to the production Uniformen with no user and no app name:

```tsx
import { fetchUniformenComponents } from "@entur/uniformen/react";

const { HeadAssets, Header, Footer, Scripts } = await fetchUniformenComponents({
  token,
  environment: "dev",
  params: { app: "partner", sidebar: true, locale: "nb-NO" },
});
```

`headAssets` carries the whole sidebar behaviour and restores the stored collapse state before first paint, so a `<HeadAssets />` rendered anywhere but `<head>` gives you a bar that jumps on load.

### Step 4: Render without the chrome when the fetch fails

`fetchUniformenLayout` returns `UniformenLayout | null`, and `null` is every failure at once: a timeout (5 s by default), a network error, and a `400` from a rejected parameter. The React components render nothing in that case.

The layout sits on the critical path of a page render, so treat `null` as a page that renders without the shared chrome — never as an error page, a thrown exception, or a blocking retry.

### Step 5: Union the CSP into your page's own

`layout.csp` is a `Record<string, string[]>` of per-directive sources (`style-src`, `script-src`, …) that the rendered chrome needs. Union those sources into the directives of your page's `Content-Security-Policy` header. Skipping this ships a header and footer the browser refuses to style or run.

`fetchUniformenComponents` returns `csp` beside the four components, so the React path has it from the same fetch — no second call:

```ts
const { Header, csp } = await fetchUniformenComponents({ token, environment, params });

for (const [directive, sources] of Object.entries(csp)) {
  // union `sources` into your own `directive`, don't replace it
}
```

`csp` is `{}` when the fetch failed. An app with no CSP header of its own has nothing to do here.

## Sidebar

Uniformen renders the collapse button. You render the sidebar. The state is one attribute on the root element:

```html
<html data-uniformen-sidebar="expanded | collapsed"></html>
```

Style the sidebar off that attribute — no JavaScript state to keep in sync, and correct on the first frame including in a server-rendered app:

```css
:root[data-uniformen-sidebar="collapsed"] .my-sidebar {
  width: 0;
  /* Hide it from the a11y tree and the tab order too: width alone leaves the
     links focusable and announced, so the collapsed sidebar becomes a run of
     invisible tab stops. */
  visibility: hidden;
}
```

Collapse from anywhere in the app by writing the same attribute: `document.documentElement.dataset.uniformenSidebar = "collapsed"`. Listen for `uniformen:sidebar` on `window` when script has to react; `event.detail.collapsed` is typed by the package.

To pick a different default, server-render the attribute — Uniformen writes it itself only when the user has a stored preference, or when nothing set it at all.

## Language

`params.locale` is the language the service renders in. `params.availableLocales` adds the switcher, and lists only the tags **your app** translates.

Uniformen owns the control; your app owns the choice. A pick dispatches one event and does nothing else:

```ts
window.addEventListener("uniformen:locale", (event) => {
  const { locale } = event.detail;
  // persist however your app persists it, then:
  window.location.reload();
});
```

The reload completes the change, because a server-rendered header and your own loaded modules both resolve their language at document load. On the next render, send the stored choice back as `params.locale` and set `<html lang>` to match.

## Checking the result by hand

The service's root path renders the header and footer as a page, with a control panel for every parameter and the URL it produces: https://uniformen.entur.no. Reach for it to see what a parameter combination looks like before wiring it into an app.
