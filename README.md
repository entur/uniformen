# uniformen

Header og footer for Entur

Changes to what the service renders are listed in [CHANGELOG.md](./CHANGELOG.md).
Changes to the client library's API are listed in
[its own changelog](./packages/uniformen/CHANGELOG.md).

## Skill for AI coding agents

[`skills/entur-uniformen`](./skills/entur-uniformen/SKILL.md) teaches an agent how to add
Uniformen to an Entur application. It is published through the Entur plugin
marketplace. The marketplace reads the skill directly from this repo and keeps no copy
of it. To install it:

```sh
claude plugin marketplace add entur/ai
claude   # then /plugin, and install "entur-uniformen"
```

For Codex CLI, run `codex plugin marketplace add entur/ai`. The marketplace entry
points to the `main` branch, so a change to `SKILL.md` on `main` is published right
away. See [skills/README.md](./skills/README.md).

## Install

To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

Then open http://localhost:4123.

## Preview

The root path renders the header and footer on a page, so you can look at them in
the browser. It takes the same query parameters as `/ssr`, plus a few parameters for
testing. Those have a `debug` prefix.

The page has a form with a control for every parameter below. The controls are
placed like the parts of the bar they change: controls for the left side of the bar
on the left, controls for the right side on the right, and the rest below. A checkbox
or a menu applies the change when you pick a value. A text field applies it when you
leave the field. The page also shows the URL for the current settings, so you can copy
it. The URL has only the parameters the server accepted, and leaves out unknown
parameters and parameters set to their default value.

| Parameter          | Values                                                                                       | What it does                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`              | `bedrift`, `cleos`, `nplan`, `ops-center`, `partner`, `skoleskyss`, `sorvis`                 | Shows the app name beside the logo and marks the app in the app switcher. For Entur users, the environment badge becomes a switcher with links to the environments the app is deployed to. No default. Any other value returns `400`.                                                                                                                                                                                                 |
| `debugEnturUser`   | `true`, `false`                                                                              | `true` renders the bar as for an Entur user, which shows the environment badge. Default `false`. Any other value returns `400`. Preview page only.                                                                                                                                                                                                                                                                                    |
| `sidebar`          | `true`, `false`                                                                              | `true` renders the button that collapses the app's side navigation. The preview page also shows a demo sidebar for the button to act on. Default `false`. Any other value returns `400`.                                                                                                                                                                                                                                              |
| `simple`           | `true`, `false`                                                                              | `true` hides the app switcher, notifications, the sidebar button and "Mine tilganger". When `true`, `sidebar` is ignored. The footer does not change. Default `false`. Any other value returns `400`.                                                                                                                                                                                                                                 |
| `contrast`         | `true`, `false`                                                                              | `true` renders the bar and its panels in the design system's contrast colours. Use it when the page behind the header is dark. Default `false`. Any other value returns `400`.                                                                                                                                                                                                                                                        |
| `loginUrl`         | a path on the app's own origin, e.g. `/auth/login`, at most 512 characters                   | The link target for "Logg inn" on the bar for users who are not signed in. If it is not set, there is no login link. An absolute URL, `//host` or `javascript:` returns `400`.                                                                                                                                                                                                                                                        |
| `logoutUrl`        | a path on the app's own origin, e.g. `/auth/logout`, at most 512 characters                  | The link target for "Logg ut" in the signed-in user's menu. If it is not set, there is no logout link. An absolute URL, `//host` or `javascript:` returns `400`.                                                                                                                                                                                                                                                                      |
| `locale`           | `nb-NO` (default), `nn-NO`, `en-GB`                                                          | The language of the header and footer. The preview page also sets `<html lang>` to this value. Any other value returns `400`.                                                                                                                                                                                                                                                                                                         |
| `availableLocales` | any of `nb-NO`, `nn-NO`, `en-GB`, repeated: `?availableLocales=nb-NO&availableLocales=en-GB` | The languages the app offers, in the order to list them in the language switcher. For a signed-in user the switcher is a section in the user menu, also with `simple`. For other users it is a separate button next to the login link. The list must include `locale`, which is shown as the selected language. If it is not set, there is no switcher. An unknown value, a repeated value, or a list without `locale` returns `400`. |
| `debugUser`        | any text, 1–120 characters                                                                   | Renders the bar as signed in, with this name. If it is not set, the bar is rendered for a user who is not signed in. Text outside the length limits returns `400`. Preview page only.                                                                                                                                                                                                                                                 |
| `debugEmail`       | any text, 1–120 characters                                                                   | The line under the name in the user menu. Text outside the length limits returns `400`. Preview page only.                                                                                                                                                                                                                                                                                                                            |

```
http://localhost:4123/?app=partner&sidebar=true&debugUser=Navne+Navnesen&debugEmail=navne.navnesen@entur.org&debugEnturUser=true
```

Only the preview page reads the `debug` parameters. `/ssr` ignores them, because the
signed-in user and their organisation must come from the token, not from the URL. The
preview page also ignores them in production. Otherwise anyone could share a
production link that shows a signed-in user without a session, or shows controls the
viewer does not have access to.

## The environment badge

The environment badge next to the logo is shown only to users in the Entur
organisation. When the app sends `app`, the badge becomes an environment switcher.
A user is in the Entur organisation when their userinfo has the claim
`https://entur.io/organisationID` set to `ENTUR_ORGANISATION_ID`
(`src/auth/enturOrganisation.ts`). All other users, signed in or not, get the bar
without the badge.

The coloured strip along the top of the header is shown to everyone. It tells the
viewer that the page is not production. Production has no strip.

The check uses the user's profile from the userinfo lookup. If the lookup fails, the
bar is rendered without the badge.

## Contributing

Team Portal maintains this repository. We accept pull requests from Entur teams
only. [CONTRIBUTING.md](./CONTRIBUTING.md) describes the setup, the checks CI runs,
and the rules for commits, changelogs and new query parameters. Anyone can open an
issue. Report security problems as described in [SECURITY.md](./SECURITY.md), not in
an issue.

## Licence

[EUPL-1.2](./LICENSE). © Entur AS.
