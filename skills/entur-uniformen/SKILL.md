---
name: entur-uniformen
description: Uniformen is the shared header and footer of Entur's B2B and partner-facing portals. The service renders them, and apps fetch them on the server with the @entur/uniformen package. Use when adding, upgrading or debugging the shared top bar, nav bar, header, footer or app switcher in an Entur portal application; when wiring the sidebar collapse control, the language switcher or the environment badge; when a page's Content-Security-Policy must allow the shared chrome; when starting a new Entur portal or partner-facing frontend that needs the shared chrome; and whenever fetchUniformenLayout, fetchUniformenComponents, uniformen:sidebar or data-uniformen-sidebar appear in the task.
---

> **Audience:** AI coding agents that add Uniformen to an Entur application. If you are working on the service itself, read the repository README at https://github.com/entur/uniformen instead.

# Uniformen

Uniformen is Entur's shared header and footer. One service renders them, and every portal application embeds the same HTML. When the header or footer changes, your app gets the change without a new release of your app.

**Who it is for.** Uniformen is for Entur's B2B portals. These are the applications that Entur's partners and Entur's own employees sign in to, for example `partner`, `cleos`, `nplan`, `ops-center`, `skoleskyss` and `sorvis`. Users often move between several of these applications, and they all get the same header, the same app switcher and the same account menu. Public sites for travellers use a different header and footer, and this service does not render those.

The service has an endpoint, `/ssr`, that returns the layout as JSON. `@entur/uniformen` is the client for that endpoint.

**Server-side rendering only.** Always fetch the layout on the server while the document is rendered, for example in a loader, a server component or a request handler. There are two reasons. `/ssr` sends no CORS headers, so the browser blocks a fetch from your app's origin. And the request carries the user's Auth0 access token, which must not be sent to the browser. An app that renders only in the browser must add a server render for the page shell, even a small one, and fetch the layout there.

**Languages other than JavaScript.** `@entur/uniformen` is the client for JavaScript and TypeScript, and it is the only client today. The service works with any language: `/ssr` is a plain HTTP endpoint that returns JSON. A server in any language can call it with a bearer token and place the four HTML fields itself, as described below. If your app uses another stack and needs its own client, ask in **#work-micro-frontend** in Entur's Slack.

**Package README** (the full client API; trust it where this skill has less detail): https://raw.githubusercontent.com/entur/uniformen/main/packages/uniformen/README.md
**Service README** (`/ssr` parameters, environment badge, preview page): https://raw.githubusercontent.com/entur/uniformen/main/README.md

## Starting a new frontend

Start a new B2B or partner-facing portal from the template, not from an empty Vite app:

```sh
gh repo create entur/<app-name> --template entur/create-entur-frontend --internal
```

https://github.com/entur/create-entur-frontend is a TanStack Start app with the Entur design system, Tailwind, Vitest and Bun. Uniformen is already set up in it. `fetchUniformenComponents` is called in the root loader (`src/routes/__root.tsx`), the options are in `config.uniformen` (`src/server/auth/config.ts`), and the environment variables `ENVIRONMENT` and `UNIFORMEN_APP` set those options. If you start from the template, use the rest of this skill to change the setup, not to build it.

Follow the steps below only when the app already exists and you need to add Uniformen to it.

## Integrating

### Step 1: Install

```sh
npm install @entur/uniformen   # or: bun add @entur/uniformen
```

The package needs React 18 or later as a peer dependency. It has two entry points: `@entur/uniformen` returns the layout as HTML strings, and `@entur/uniformen/react` returns React components. In a React app, use the React entry point. It turns the HTML into React elements, so you do not need `dangerouslySetInnerHTML`.

### Step 2: Pick one entry point

The two entry points take the same options. Call one of them, not both:

| Entry point                                           | Returns                                                  | Use it when                                                    |
| ----------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `fetchUniformenComponents` (`@entur/uniformen/react`) | `{ HeadAssets, Header, Footer, Scripts, csp }`           | React app. Use this one; it turns the HTML into React elements |
| `fetchUniformenLayout` (`@entur/uniformen`)           | `UniformenLayout \| null` — four HTML strings plus `csp` | No React: place the four strings yourself                      |

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

Call this on the server, where the document is rendered. The layout is part of the page's first HTML response. The browser does not fetch it later.

`token` adds the signed-in user to the bar. Without a token the layout still renders, as a bar with no app switcher and no user menu. So a page that is rendered before sign-in just leaves out `token`. That bar shows a "Logg inn" link only if you send `params.loginUrl`, which must be a path on your own origin. The service does not know your login route, and any value that is not a path returns `400`. The "Logg ut" link in the signed-in user's menu works the same way, with `params.logoutUrl`. Your app ends the session, so your app sets the route.

`environment` selects which Uniformen instance the layout comes from. It must match the environment your app runs in. The app switcher links to apps in the environment you fetched from, so a production layout in dev sends your users to the production versions of all the other portal applications.

The `params` are documented in the JSDoc on `FetchUniformenParams`. Read the type instead of guessing.

### Registering a new app

To add an application to the list of `app` values, open a pull request to `entur/uniformen`. Until it is merged, fetch the layout without `app`. The bar still renders, but without an app name, without an entry in the switcher and without an environment switcher.

The pull request adds one entry to `APPLICATIONS` in `src/components/portalApplications.ts`:

```ts
{
  id: "my-app",          // the value apps send as the `app` param
  appName: "My App",     // the name beside the logo and in the switcher
  hosts: {               // leave out environments the app is not deployed to
    dev: "my-app.dev.entur.io",
    staging: "my-app.staging.entur.io",
    production: "my-app.entur.io",
  },
},
```

Put the entry in the order the switcher shows them. The order is alphabetical by `appName` in Norwegian collation, with Ø last. Add `unlisted: true` for an app that uses the header and footer but should not appear in the app switcher.

Then add the same id to the `app` union of `FetchUniformenParams` in `packages/uniformen/src/types.ts`. Apps can use it after the next release of the package. If you are not sure where the app belongs in the portal, ask in **#work-micro-frontend**.

### Step 3: Render all four pieces, in their places

`UniformenLayout` has four HTML fields. Each one must go in a specific place:

| Field        | React component  | Where                                |
| ------------ | ---------------- | ------------------------------------ |
| `headAssets` | `<HeadAssets />` | inside `<head>`                      |
| `headerHtml` | `<Header />`     | inside `<body>`, before `<main>`     |
| `footerHtml` | `<Footer />`     | inside `<body>`, after `<main>`      |
| `scripts`    | `<Scripts />`    | inside `<body>`, as the last element |

The React entry point takes the same options as `fetchUniformenLayout`. Pass all of them. Without options, it fetches from the production Uniformen, with no user and no app name:

```tsx
import { fetchUniformenComponents } from "@entur/uniformen/react";

const { HeadAssets, Header, Footer, Scripts } = await fetchUniformenComponents({
  token,
  environment: "dev",
  params: { app: "partner", sidebar: true, locale: "nb-NO" },
});
```

`headAssets` contains all the sidebar behaviour. It restores the saved collapsed or expanded state before the first paint. If you render `<HeadAssets />` anywhere other than `<head>`, the bar jumps when the page loads.

### Step 4: Render without the chrome when the fetch fails

`fetchUniformenLayout` returns `UniformenLayout | null`. It returns `null` for every kind of failure: a timeout (5 seconds by default), a network error, or a `400` for an invalid parameter. In that case the React components render nothing.

The page waits for the layout before it renders. So when you get `null`, render the page without the shared header and footer. Do not show an error page, throw an exception or retry while the page waits.

### Step 5: Add the CSP sources to your page's CSP

`layout.csp` is a `Record<string, string[]>`. For each directive (`style-src`, `script-src` and so on) it lists the sources the header and footer need. Add those sources to the same directives in your page's `Content-Security-Policy` header. If you skip this, the browser blocks the styles and scripts of the header and footer.

`fetchUniformenComponents` returns `csp` together with the four components, so the React entry point needs no second call:

```ts
const { Header, csp } = await fetchUniformenComponents({ token, environment, params });

for (const [directive, sources] of Object.entries(csp)) {
  // add `sources` to your own `directive`; do not replace it
}
```

`csp` is `{}` when the fetch failed. If your app has no CSP header, skip this step.

## Sidebar

Uniformen renders the button that collapses the sidebar. Your app renders the sidebar itself. The state is stored in one attribute on the root element:

```html
<html data-uniformen-sidebar="expanded | collapsed"></html>
```

Style the sidebar based on that attribute. Then there is no JavaScript state to keep in sync, and the sidebar is correct from the first frame, also in a server-rendered app:

```css
:root[data-uniformen-sidebar="collapsed"] .my-sidebar {
  width: 0;
  /* Also hide it from screen readers and the tab order. With only width: 0,
     screen readers still read the links and users can still tab to them. */
  visibility: hidden;
}
```

To collapse the sidebar from anywhere in the app, set the same attribute: `document.documentElement.dataset.uniformenSidebar = "collapsed"`. If your script needs to react to changes, listen for `uniformen:sidebar` on `window`. The package has a type for `event.detail.collapsed`.

To choose a different default, render the attribute on the server. Uniformen only sets it when the user has a saved preference, or when the attribute is not set.

## Language

`params.locale` is the language the service renders in. `params.availableLocales` adds a language switcher. List only the languages that **your app** is translated into.

Uniformen renders the switcher, and your app handles the change. When the user picks a language, the switcher dispatches one event and does nothing else:

```ts
window.addEventListener("uniformen:locale", (event) => {
  const { locale } = event.detail;
  // save the choice the way your app saves settings, then:
  window.location.reload();
});
```

The reload is needed because the server-rendered header and your app's loaded modules both pick their language when the document loads. On the next render, send the saved choice as `params.locale` and set `<html lang>` to the same value.

## Checking the result by hand

The root path of the service shows the header and footer on a page, with a control for every parameter and the URL for the current settings: https://uniformen.entur.no. Use it to see what a set of parameters looks like before you add it to an app.
