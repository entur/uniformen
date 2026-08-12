# uniformen

Header og footer for Entur

What the service renders is changelogged in [CHANGELOG.md](./CHANGELOG.md); the
client library's own API in [its changelog](./packages/uniformen/CHANGELOG.md).

## Install

To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

open http://localhost:4123

## Preview

The root path renders the header and footer in a page, so they can be looked at by
hand. It takes the same query parameters as `/ssr`, plus a few that only make sense
for a dev tool — those carry a `debug` prefix.

| Parameter | Values | What it does |
| --- | --- | --- |
| `app` | `cleos`, `nplan`, `ops-center`, `partner`, `sorvis` | Names the app beside the logo, marks its entry in the app switcher, and turns the environment badge into a switcher. Sent by the consuming app. |
| `debugEnturUser` | `true`, `false` | Renders the bar as an Entur user's, which is the one that carries the environment badge. Preview only. |
| `sidebar` | `true`, `false` | Whether the app has a side navigation to collapse. The preview page also gets a demo sidebar for the control to act on. |
| `simple` | `true`, `false` | Hides the app switcher, notifications, the sidebar toggle and "Mine tilganger". Overrides `sidebar`. Footer unchanged. |
| `locale` | `nb-NO` (default), `nn-NO`, `en-GB` | The language the header and footer are written in. The preview page also renders `<html lang>` as it. |
| `availableLocales` | any of `nb-NO`, `nn-NO`, `en-GB`, repeated: `?availableLocales=nb-NO&availableLocales=en-GB` | The languages the app offers, in this order, as a switcher: a section of the user menu where the bar has one (`simple` included), its own chip beside the login link where it does not. Must include `locale`, which is the option rendered as current. Absent renders no switcher. |
| `debugUser` | any text, 1–120 chars | Renders the bar as signed in, under that name. Absent renders the anonymous bar with its login link. Preview only. |
| `debugEmail` | any text, 1–120 chars | The line under the name in the user menu. Preview only. |

```
http://localhost:4123/?app=partner&sidebar=true&debugUser=Navne+Navnesen&debugEmail=navne.navnesen@entur.org&debugEnturUser=true
```

The `debug` parameters are the preview page's own: `/ssr` ignores them, since who is
signed in and what organisation they are in are things a consumer's token
establishes and not something its URL gets to claim. They are ignored in production
too — a page that names a user with no session behind it, or offers chrome the
viewer is not entitled to, is a misleading thing to be able to link to.

## The environment badge

The badge next to the logo, and the switcher it becomes when the consumer sends
`app`, are rendered only for users in the Entur organisation — the ones whose
userinfo carries `https://entur.io/organisationID` as `ENTUR_ORGANISATION_ID`
(`src/auth/enturOrganisation.ts`, the same id entur-partner reads the claim
against). Everyone else, signed in or not, gets the bar without it. The coloured
strip along the top of the header is not gated: it warns whoever is looking at the
page that it is not production, and production has never had one.

The gate reads the token's profile, so a failed userinfo lookup renders the bar
without the badge rather than with it.
