# Contributing

Uniformen is maintained by Team Portal at Entur. The source is public so that the
teams embedding the header and footer can read what they are embedding, and so the
`@entur/uniformen` package can be built and inspected.

**Pull requests are accepted from Entur teams only.** The header and footer render
inside every Entur B2B application and carry Entur's branding, so what ships here is
an internal editorial decision. Pull requests from outside Entur will be closed
without review.

Outside Entur:

- **Found a bug, or something that looks wrong?** Open an issue. Issues are read.
- **Found a security problem?** See [SECURITY.md](SECURITY.md) — not an issue, not a
  pull request.
- **Need different behaviour for your own use?** The EUPL-1.2 lets you fork and
  modify. We do not take the change upstream.

The rest of this document is for Entur teams.

## Before you start

For anything more than a small fix, open an issue or reach Team Portal first. A change
here ships to every Entur B2B application at once, so it is worth agreeing on the shape
of a change before it is written.

## Getting set up

Requires Bun — the version is pinned in the Dockerfile and in CI.

```sh
bun install
cp .env.example .env
bun run dev
```

The dev server listens on http://localhost:4123. The root path renders the header and
footer in a page with a form for every query parameter, so changes can be looked at by
hand — see the README for what each parameter does.

## Checks

Run all of these before opening a pull request. CI runs the same set and fails on any
of them:

| What | Command |
|------|---------|
| Types | `bun run tsc` |
| Lint | `bun run lint` |
| Format | `bun run fmt:check` (`bun run fmt` to fix) |
| Tests | `bun run test` |
| Dependency audit | `bun audit --audit-level=critical` |

The client package in `packages/uniformen` has its own set of the same scripts; run
them from that directory when you change it.

## Commits and pull requests

Commit subjects carry the Jira key where there is one, then a description in the
imperative:

```text
ETU-76720 add new param loginUrl which renders the "Logg inn" button when specified
```

Without a Jira key, the description alone is fine. Keep the subject on one line and
say what the change does, not what file it touches.

Pull requests need a review from [@entur/team-portal](CODEOWNERS). Keep a pull request
to one change — it makes review and rollback simpler.

## What a change should come with

- **Tests.** The repository tests behaviour, not implementation: rendering, parameter
  validation, and auth are covered by tests next to the code they exercise.
- **Changelog.** User-visible changes to what the service renders go in
  [CHANGELOG.md](CHANGELOG.md); changes to the client library's API go in
  [its changelog](packages/uniformen/CHANGELOG.md).
- **Documentation.** A new or changed query parameter belongs in the README parameter
  table and in the preview page's controls.

## Adding an application to the app switcher

Applications live in `src/components/portalApplications.ts`, one entry per app with
its hosts per environment. Entries are declared in the order the switcher lists them:
alphabetical by name in Norwegian collation. Leave out an environment the app is not
deployed to.

## Dependencies

Dependencies are pinned exactly (`bunfig.toml` sets `exact = true`) and a package
version must have been published at least three days earlier before it can be
installed. Dependabot opens upgrade pull requests; prefer those over upgrading by hand.

## Licence

Contributions are licensed under the EUPL-1.2, the licence this repository is
released under. See [LICENSE](LICENSE).
