# Uniformen

A TypeScript service on Bun and Hono. It server-renders the header and footer that
every Entur B2B application embeds. The repository also holds the `@entur/uniformen`
client package, which fetches the header and footer and adds them to a page.

## Entur Standards

Read and follow the Entur platform standards at:
https://github.com/entur/ai/blob/main/AGENTS.md

## Project-Specific

- App ID: `uniformen`
- Kubernetes namespace: `uniformen`
- GCP projects: `ent-uniformen-dev`, `ent-uniformen-tst`, `ent-uniformen-prd`
- Owner: `@entur/team-portal`
- Licence: EUPL-1.2. This repository is public. Do not add code, assets or
  configuration that cannot be published under this licence.
- Anyone can read the code, but we accept pull requests from Entur teams only. See
  [CONTRIBUTING.md](CONTRIBUTING.md).

## Commands

| Task | Command |
|------|---------|
| Install | `bun install` |
| Run locally | `bun run dev` (http://localhost:4123) |
| Types | `bun run tsc` |
| Lint | `bun run lint` |
| Format | `bun run fmt` / `bun run fmt:check` |
| Test | `bun run test` |

The client package in `packages/uniformen` has the same scripts. Run them from that
directory.

## Layout

| Path | What it holds |
|------|---------------|
| `src/ssr/` | Server-side rendering of the bar and footer, and the preview page |
| `src/components/` | The bar's pieces, their browser-side handlers, and the application registry |
| `src/auth/` | Auth0 JWT validation and user-info lookup |
| `packages/uniformen/` | The published client package, versioned separately |
| `skills/entur-uniformen/` | Agent skill shipped through the Entur plugin marketplace |

## Conventions

- A commit subject for the service starts with the Jira key, if there is one, and
  then describes the change in the imperative: `ETU-76720 add new param loginUrl which
  renders the "Logg inn" button`.
- A change under `packages/uniformen/` uses a Conventional Commits subject instead,
  because release-please reads it to decide the package's next version:
  `feat(uniformen): add loginUrl to the render options`. Types: `feat` (minor),
  `fix` (patch), `feat!` or a `BREAKING CHANGE:` footer (major), and `chore`, `docs`,
  `refactor`, `test`, `build`, `ci` for changes users do not see. Put the Jira key in
  the body, not the subject. `Verify PR` checks this on every pull request that
  changes the package. Pull requests that do not change the package are not checked.
- Do not mix service changes and package changes in one pull request. A squash merge
  gives the pull request a single subject, so a `feat(uniformen):` title releases the
  package even when most of the diff is service code. Watch out for two things. A
  squash of a **single commit** uses the *commit* subject, not the pull request title.
  And the squash body contains every commit message, so a `BREAKING CHANGE:` footer
  in any commit makes a major release. Merge and rebase are also enabled. With those,
  every commit subject goes to `main` unchanged.
- Dependencies are pinned to exact versions. `bunfig.toml` also blocks any package
  version published less than three days ago. Do not relax either rule.
- Write user-visible render changes in `CHANGELOG.md` by hand, under a date.
  release-please generates `packages/uniformen/CHANGELOG.md` from commit subjects. Do
  not edit it, and do not change `version` in the package's `package.json` by hand.
- When you add or change a query parameter, update three places: the handler, the
  README parameter table and the preview page's controls.
- List applications in `src/components/portalApplications.ts` in the order the
  switcher shows them. The order is alphabetical by Norwegian collation, with Ø last.

## Code comments: plain English

Write comments a new developer, possibly not a native English speaker, understands
on first read. Write like you are explaining the code to a colleague sitting next to
you. These rules apply to every comment: TS, TSX, CSS, YAML, Dockerfile and JSDoc.
The same plain language applies to the READMEs, this file and the skill.

### Talk about the code next to the comment

- **Describe this code, not the system.** Say what the code below does (only if it
  is not obvious) and why it is needed. Do not explain the architecture, the design
  philosophy or how the whole feature works.
- **Don't describe other files.** Don't say what another module, component, test or
  stylesheet does. That belongs in a comment in that file, and a copy here goes out
  of date without anyone noticing. At most, name it: "See `panelToggle`."
- **No history or alternatives.** Don't write what the code used to do, what was
  tried, or what it does not do, unless leaving it out would lead someone to break
  the code.
- **Tests:** the test name and assertions say what is tested. Only comment on setup
  that is not obvious.
- **No comment is fine.** If the code is clear, don't write one.

### Write plain sentences

- **Full, simple sentences in normal word order.** Start function docs with a verb
  ("Returns…", "Checks whether…"), not a noun-phrase fragment.
- **Short means fewer sentences, not squeezed ones.** Usually 1–3 sentences. Cut
  ideas, never grammar. If a sentence needs a second read, rewrite it.
- **Say who does what.** No ownership phrases like "the token's to say", "nobody's to
  store", "the app's to change".
- **No slogans.** No colon-packed lines like "Graceful first, then forced: …" or
  "Re-asserted rather than trusted".
- **No metaphors or drama.** Not "load-bearing", "the whole contract", "owns the
  choice", "win the race", "quietly", "the whole point". Say literally what happens.
- **Common words.** "use" not "honor", "check" not "probe", "merge" not "union",
  "fallback" not "degraded path", "only used by tests" not "test seam".
- **Spell out non-standard abbreviations.** "micro frontends" not "MFs", "network
  policy" not "netpol". Standard terms (CSRF, CSP, JWT, SSR, BFF) are fine.
- **No symbols as prose.** No `==`, `>=`, `→`, `--` or chained em dashes in sentences.
- **Don't repeat the code.** Delete comments like `// Fetch assets` above `fetchAssets()`.

### Keep the facts

Security reasoning, TODOs, ticket keys, "delete when" notes and lint directives stay.

### Examples

- Bad: `// _next is unused but load-bearing: Express dispatches on arity.`
- Good: `// _next is unused, but it must stay. Express only treats a handler as an
  error handler when it takes four arguments.`

- Bad: `// Token-derived props last: navProps is the query's half, and who is signed
  in is the token's to say, never a URL's.`
- Good: `// Put user and isEnturUser after navProps so the query cannot override them.
  They must come from the verified token.`

- Bad: `// The markup arrives roved, on the checked option. Re-asserted rather than
  trusted: where it agrees these writes change nothing…`
- Good: `// Set the tabindex again here in case the server-rendered markup is wrong.`

## Critical Rules

- Anyone can read everything committed here, including commit messages and git
  history. Do **not** add internal-only material to the repository: Confluence or
  Jira links, internal runbooks, customer names, or anything about Entur systems that
  people outside Entur should not see. A Jira key in a commit subject is fine. The
  contents of the ticket are not.
- Do **not** commit secrets. Runtime secrets come from Secret Manager through the Helm
  chart. `.env` is git-ignored, and `.env.example` contains only public OIDC endpoints.
- Do **not** add third-party fonts, images or icons. Every bundled asset must have a
  licence that allows us to publish it in this public repository.
- The `/ssr` endpoint is public. The token is optional and only adds the user to the
  bar. With an invalid or missing token, the endpoint renders the bar for a user who
  is not signed in. It does not return an error. Keep this behaviour, and do not turn
  it into an authorization check.
- `loginUrl` and `logoutUrl` accept only a path on the app's own origin. Absolute
  URLs, `//host` and `javascript:` are rejected with a 400. This protects against open
  redirects, so keep the check strict.
