# Contributing

Team Portal at Entur maintains Uniformen. The source is public so that teams who
embed the header and footer can read the code, and so that anyone can build and
inspect the `@entur/uniformen` package.

**We accept pull requests from Entur teams only.** The header and footer are shown in
every Entur B2B application and carry Entur's branding, so Entur decides what goes
into them. We close pull requests from outside Entur without review.

If you are outside Entur:

- **Found a bug, or something that looks wrong?** Open an issue. We read them.
- **Found a security problem?** Follow [SECURITY.md](SECURITY.md). Do not open an
  issue or a pull request.
- **Need different behaviour for your own use?** The EUPL-1.2 lets you fork the
  repository and change it. We will not merge that change here.

The rest of this document is for Entur teams.

## Before you start

For anything bigger than a small fix, open an issue or contact Team Portal first. A
change here reaches every Entur B2B application at the same time, so agree on the
change before you write it.

## Getting set up

You need Bun. The Bun version is pinned in the Dockerfile and in CI.

```sh
bun install
cp .env.example .env
bun run dev
```

The dev server listens on http://localhost:4123. The root path shows the header and
footer on a page with a form for every query parameter, so you can check your changes
in the browser. The README describes each parameter.

## Checks

Run all of these before you open a pull request. CI runs the same checks and fails
if any of them fails:

| What | Command |
|------|---------|
| Types | `bun run tsc` |
| Lint | `bun run lint` |
| Format | `bun run fmt:check` (`bun run fmt` to fix) |
| Tests | `bun run test` |
| Dependency audit | `bun audit --audit-level=critical` |

The client package in `packages/uniformen` has the same scripts. When you change the
package, run them from that directory.

## Commits and pull requests

Start the commit subject with the Jira key, if there is one. Then describe the change
in the imperative:

```text
ETU-76720 add new param loginUrl which renders the "Logg inn" button when specified
```

If there is no Jira key, write only the description. Keep the subject on one line.
Say what the change does, not which files it changes.

**Changes under `packages/uniformen/` use a different format.** release-please
releases the package and reads the commit subjects to decide the next version. These
commits must use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(uniformen): add loginUrl to the render options
```

| Type | Effect on the published version |
|------|---------------------------------|
| `feat` | Minor bump |
| `fix` | Patch bump |
| `feat!`, or any type with a `BREAKING CHANGE:` footer | Major bump |
| `chore`, `docs`, `refactor`, `test`, `build`, `ci` | No release |

Put the Jira key in the commit body, not in the subject. The `Verify PR` check
enforces this format, but only on pull requests that change `packages/uniformen/`.
Pull requests that do not change the package use the Jira key format above.

Pull requests need a review from [@entur/team-portal](CODEOWNERS). Keep each pull
request to one change. This makes review and rollback easier. It also matters for
releases: a pull request that changes both the service and the package is merged
with one subject, and that subject decides whether the package is released.

The subject that ends up on `main` depends on how the pull request is merged:

- **Squash with more than one commit.** The pull request title becomes the subject,
  and every commit message is copied into the body. If any of those commits has a
  `BREAKING CHANGE:` footer, release-please makes a major release. Remove the footer
  before you merge.
- **Squash with exactly one commit.** GitHub uses the *commit* subject, not the pull
  request title. For example, if the pull request is titled `feat(uniformen): add X`
  and its only commit is `ETU-1234 add X`, the subject on `main` is `ETU-1234 add X`,
  and release-please makes no release. `Verify PR` checks the commit subject in this
  case, so make the title and the commit subject the same.
- **Merge or rebase.** Each commit subject goes to `main` unchanged, so every commit
  that changes `packages/uniformen/` needs a Conventional Commits subject.

## What a change should come with

- **Tests.** Test behaviour, not implementation. Rendering, parameter validation and
  auth have tests next to the code they test.
- **A changelog entry for the service.** Write user-visible changes to what the
  service renders in [CHANGELOG.md](CHANGELOG.md) by hand.
- **Nothing for the package changelog.** release-please generates
  [`packages/uniformen/CHANGELOG.md`](packages/uniformen/CHANGELOG.md) from commit
  subjects, so your `feat(uniformen):` subject becomes the changelog entry. Do not edit
  the file, and do not change `version` in the package's `package.json` by hand.
- **Documentation.** When you add or change a query parameter, update the handler, the
  README parameter table and the preview page's controls.

## Adding an application to the app switcher

Applications are listed in `src/components/portalApplications.ts`, with one entry per
app and its host in each environment. Put the entries in the order the switcher shows
them, which is alphabetical by name in Norwegian collation. Leave out environments the
app is not deployed to.

## Releasing the package

Nobody releases `@entur/uniformen` by hand. On every push to `main`, release-please
finds the commits that change `packages/uniformen/` and uses their types to decide
the next version. It keeps a release pull request open with the new version in
`package.json` and the generated changelog entries. When that pull request is merged,
the release is tagged and the package is published to npm.

You only need to write a correct commit subject. Do not change `version` or the
package changelog.

The service is not released this way. It is deployed from `main` when a pull request
is merged.

## Dependencies

Dependencies are pinned to exact versions (`bunfig.toml` sets `exact = true`). A
package version can only be installed when it was published at least three days ago.
Dependabot opens pull requests for upgrades. Use those instead of upgrading by hand.

## Licence

Contributions are licensed under the EUPL-1.2, the same licence as this repository.
See [LICENSE](LICENSE).
