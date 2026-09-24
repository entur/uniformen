# Skills

> **Audience:** Entur employees installing or contributing to the skills in this repo.
> **AI agents:** read the skill itself in [entur-uniformen/SKILL.md](./entur-uniformen/SKILL.md), not this file.

This folder holds agent skills for the code in this repository. Each skill is a folder
with the skill's name and contains at least a `SKILL.md`:

```text
skills/
└── entur-uniformen/
    └── SKILL.md
```

| Skill                                           | What it teaches an agent                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`entur-uniformen`](./entur-uniformen/SKILL.md) | How to add, upgrade and debug Uniformen, the shared header and footer, in an Entur portal application |

## Installing

```sh
claude plugin marketplace add entur/ai
claude   # then /plugin, and install "entur-uniformen"
```

For Codex CLI, run `codex plugin marketplace add entur/ai`.

## How it ships

The marketplace in [`entur/ai`](https://github.com/entur/ai) does not keep a copy of
this skill. Its entry has a `git-subdir` source that points to the `skills/` directory
of this repo on `main`. `entur/design-system` publishes `entur-linje` the same way:

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

This means:

- **A merge to `main` publishes the skill.** There is no version to change and no
  publish step. Every installed agent gets the new `SKILL.md` the next time it syncs.
  Write it as published documentation, not as notes.
- **The skill is also listed on [ki.entur.no](https://ki.entur.no).** The KI portal
  builds its catalogue from `entur/ai`, so the marketplace entry also makes the skill
  show up there.

## Contributing

Keep `SKILL.md` in line with the JSDoc on `FetchUniformenParams` in
`packages/uniformen/src/types.ts` and with
[the package README](../packages/uniformen/README.md). The skill tells agents to
trust the package README where the skill has less detail. If you are not sure which
source is correct, ask in **#work-micro-frontend**.
