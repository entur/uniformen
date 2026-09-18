# Skills

> **Audience:** Entur employees installing or contributing to the skills in this repo.
> **AI agents:** the skill itself is [entur-uniformen/SKILL.md](./entur-uniformen/SKILL.md) — read that, not this file.

Agent skills that live with the code they describe. Each is a folder named for the
skill, with a `SKILL.md` at minimum:

```text
skills/
└── entur-uniformen/
    └── SKILL.md
```

| Skill                                | What it teaches an agent                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| [`entur-uniformen`](./entur-uniformen/SKILL.md) | Adding, upgrading and debugging Uniformen — the shared header and footer — in an Entur portal application |

## Installing

```sh
claude plugin marketplace add entur/ai
claude   # then /plugin, and install "entur-uniformen"
```

Codex CLI: `codex plugin marketplace add entur/ai`.

## How it ships

The marketplace in [`entur/ai`](https://github.com/entur/ai) does not vendor a copy of
this skill. Its entry points a `git-subdir` source at this repo's `skills/` directory
on `main`, the same way `entur/design-system` publishes `entur-linje`:

```json
{
  "name": "entur-uniformen",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/entur/uniformen.git",
    "path": "skills",
    "ref": "main"
  },
  "strict": false,
  "skills": ["./entur-uniformen"],
  "description": "Uniformen: Entur's shared header and footer for B2B and partner-facing portals — integrating @entur/uniformen, the sidebar and language contracts, and the CSP the rendered chrome needs.",
  "category": "frontend",
  "keywords": ["entur", "uniformen", "header", "footer", "micro-frontend", "portal", "ssr"],
  "homepage": "https://uniformen.entur.no",
  "repository": "https://github.com/entur/uniformen",
  "license": "EUPL-1.2"
}
```

Two consequences worth knowing:

- **A merge to `main` is a release.** There is no version to bump and nothing to
  publish — an edit to `SKILL.md` reaches every installed agent on its next sync.
  Treat the file as shipped documentation, not as notes.
- **It reaches [ki.entur.no](https://ki.entur.no) too.** The KI portal's catalogue is
  generated from `entur/ai` at build, so the marketplace entry is also what makes the
  skill findable there.

## Contributing

Keep `SKILL.md` consistent with the source of truth it describes — the JSDoc on
`FetchUniformenParams` in `packages/uniformen/src/types.ts` and
[the package README](../packages/uniformen/README.md), which the skill names as the
authority where it is thinner. Ask in **#work-micro-frontend** if that authority is
unclear.
