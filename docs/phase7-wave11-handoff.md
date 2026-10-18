# Wave 11 handoff (cycle 11, Fear No Evil)

Resume notes for the Wave 11 PR, in the style of [phase7-wave10-handoff.md](phase7-wave10-handoff.md). The PR body has
the checklist and the owner's open items; this page has the scope, how to resume and a session log. Started 2026-10-18.

## Resuming

- **Branch:** `feature/wave-11`, off `main` at 3b840480 (v0.25.0, #247; Wave 10 was #115).
- **Read first:** the PR's top section, this page, then `docs/phase7-wave11-sources.md`,
  `docs/phase7-wave11-data-survey.md` and the spec `docs/phase7-wave11.md` once they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md). Step 6 (the box's campaign) applies:
  Fear No Evil is a campaign expansion (`docs/campaign-modes/mc60_rulebook-web.pdf`, transcribed roughly at
  `docs/campaign-modes/markdown/mc60_fear_no_evil.md`).
- **Order of work** (as waves 5 to 10): sources and data survey, spec, data emitted, engine primitives, scripting,
  rules QA, custom decks, client and Guided mode, campaign, progression, shipping. Each piece goes through the
  `code-reviewer` agent before it is committed (CLAUDE.md "When to hand code to the code reviewer").
- **Testing:** CI runs the full unit suite; locally only the touched test files plus typecheck and lint.
- **Rules questions:** settled by the authority order in CLAUDE.md first; only what it cannot settle goes on the PR's
  question table.
- **Windows tools:** `pnpm` via `C:/Users/quinc/scoop/shims/mise.exe exec -- pnpm …` if not on the PATH; no `jq`, use
  `node -e`. Rulebook pages: `uv run docs/extract_pages.py docs/campaign-modes/mc60_rulebook-web.pdf -p 1-20 --dpi 110
  -o <scratch dir>`.

## E2e pre-push hook: off on this branch (owner, 2026-10-18)

`.githooks/pre-push` is deleted on this branch until the client work is in; its last version is on `main` at 3b840480.
`e2e-gate.sh`, `pre-commit` and `commit-msg` are unchanged, and `pnpm e2e:verify` still runs the suite on demand.
**Restore it when the client step (definition of done §5) starts landing**
(`git checkout origin/main -- .githooks/pre-push`); this PR must not merge without it. E2e runs only on the owner's
Windows rig, queued on `%TEMP%\mc-e2e.lock`.

## Scope (provisional until the sources page confirms it)

RRG 1.8 Appendix VI (p. 71) lists waves 1 to 10 only, so cycle 11 follows release order (Hall of Heroes index lines 41,
61, 69). Id: `cycleId("cycle11")`.

| Pack        | Product             | Type               | Released    | Data at the start     |
| ----------- | ------------------- | ------------------ | ----------- | --------------------- |
| `fne`       | Fear No Evil, MC60  | Campaign expansion | July 2026   | raw cache, 66 records |
| `jj`        | Jessica Jones, MC61 | Hero pack          | August 2026 | raw cache, 42 records |
| `luke_cage` | Luke Cage, MC62     | Hero pack          | August 2026 | raw cache, 37 records |

Box heroes: Daredevil (60001a, with a Sense deck) and Echo (60037a). Villains named by the index: Bullseye, Electro,
Hammerhead, Purple Man, Typhoid Mary, Kingpin. 66 records is short for a campaign box; the data survey checks whether
the cache is complete. Empty art folders wait in `art/heroes/_pending/`. Not in scope: Synthezoid Smackdown (its own PR).

## Session log

- **2026-10-18.** Branch and draft PR opened; the e2e pre-push hook removed on the branch. Added the `code-reviewer` agent and the CLAUDE.md section on when to call
  it.
