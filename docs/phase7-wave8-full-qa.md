# Phase 7 wave 8: full QA and code review (started 2026-10-09)

The owner asked for "a full QA + code review" of wave 8 (PR #103) after it left draft, and for progress to be kept
where another session can pick it up. **This page is that record.** Update the table after every piece, commit it
(`git commit --no-verify -- docs/phase7-wave8-full-qa.md`) and push; a docs-only push does not run the e2e gate.

## How to resume

1. `git fetch origin feature/wave-8 && git status`: the branch on GitHub is the source of truth. A piece marked
   "running" below with no result recorded did not finish: check for its output file (an untracked
   `full-qa-audit.qa.test.ts` in that pack's folder) and either keep it (run it, lint it, commit it) or start the
   piece again.
2. Start the next "queued" pieces, at most three agents at once, one small piece each. Auditors and reviewers only
   report and pin (`it.fails`); they add one new file and edit nothing else. The main session verifies, commits by
   explicit path and updates this page.
3. When every piece has a result, fix the defects (one small agent per area, the owning specialist), turn each
   `it.fails` into a passing test only after its behavior is corrected, run `pnpm check` and `pnpm e2e:verify`, push,
   and write the summary into [phase7-wave8-qa.md](phase7-wave8-qa.md) and the PR.
4. Rules questions go to the owner as short multiple choice with a recommended default; answers go in
   [phase7-wave8.md](phase7-wave8.md) §4.1 (next free row: 91). An owner decision is not an official ruling: say which.

## Pieces

| #   | Piece                                                                                                                         | Agent type          | State   | Result                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Automated suites on ea9c1cc3: `pnpm check`, Playwright (166 passed)                                                           | main session        | done    | green                                                                                                                                                        |
| 1   | Card audit: Bishop (`wave8/aoa/bishop/full-qa-audit.qa.test.ts`)                                                              | rules-qa-engineer   | done    | 26 cards; no defects; 3 new passing tests. Thin: Advanced Suit's side scheme branch, Cable and Sidekick with two players                                     |
| 2   | Card audit: Magik (`wave8/aoa/magik/full-qa-audit.qa.test.ts`)                                                                | rules-qa-engineer   | done    | 30 cards; 1 defect (Scrying); 7 new passing tests                                                                                                            |
| 3   | Card audit: Iceman (`wave8/iceman/full-qa-audit.qa.test.ts`)                                                                  | rules-qa-engineer   | done    | 32 cards; no defects; 6 new passing tests. Thin: Frostbite across a stage with a new title or on a confused enemy, Life Drain ties, Eye of Sauron icon order |
| 4   | Card audit: Jubilee (`wave8/jubilee/full-qa-audit.qa.test.ts`)                                                                | rules-qa-engineer   | running |                                                                                                                                                              |
| 5   | Card audit: Nightcrawler (`wave8/ncrawler/full-qa-audit.qa.test.ts`)                                                          | rules-qa-engineer   | running |                                                                                                                                                              |
| 6   | Card audit: Magneto (`wave8/magneto/full-qa-audit.qa.test.ts`)                                                                | rules-qa-engineer   | running |                                                                                                                                                              |
| 7   | Encounter audit: Unus, Four Horsemen, Apocalypse (villains, main schemes, sets)                                               | rules-qa-engineer   | queued  |                                                                                                                                                              |
| 8   | Encounter audit: Dark Beast, En Sabah Nur, the modular sets                                                                   | rules-qa-engineer   | queued  |                                                                                                                                                              |
| 9   | Encounter audit: campaign cards, missions, Overseers and Prelates, rewards                                                    | rules-qa-engineer   | queued  |                                                                                                                                                              |
| 10  | Code review: `packages/engine` diff against `origin/main`                                                                     | general (read-only) | queued  |                                                                                                                                                              |
| 11  | Code review: `packages/cards` shared code (dsl, testing, playable, setup, campaign) and `packages/content` schema and scripts | general (read-only) | queued  |                                                                                                                                                              |
| 12  | Code review: `packages/client` diff against `origin/main`                                                                     | general (read-only) | queued  |                                                                                                                                                              |
| 13  | Browser: two-hero and Expert games of each of the five scenarios                                                              | general (read-only) | queued  |                                                                                                                                                              |
| 14  | Browser: phone (390x844) and tablet (768x1024) on the wave's screens                                                          | general (read-only) | queued  |                                                                                                                                                              |
| 15  | Browser: Guided mode glossary entries, tips and the six Try-its                                                               | general (read-only) | queued  |                                                                                                                                                              |
| 16  | Fix what was found, recheck, push                                                                                             | owning specialists  | queued  |                                                                                                                                                              |
| 17  | Write the results into the QA page and the PR                                                                                 | main session        | queued  |                                                                                                                                                              |

## Defects found

One row per defect: piece, card or file, what is wrong, source, severity, the pinning test, fixed in.

- **Piece 2, Scrying 45036 (low to medium).** Printed "Draw one"; the script moves the card to hand, so no `cardDrawn` event is emitted and nothing that answers a draw would see it. Source: printed text (RRG "Draw" not yet looked up). Pinned: `wave8/aoa/magik/full-qa-audit.qa.test.ts`, "the chosen card is drawn (emits cardDrawn), not merely moved to the hand". Fixed in: open.

## Questions for the owner

None yet.

## Code review brief (pieces 10 to 12)

Read-only: no edits, no git writes. Review `git diff origin/main...HEAD -- <package>` (use `--stat` first and read the
changed source files; skip generated data and test fixtures). Look for: correctness bugs and unhandled cases; engine
code that names a specific card or pack (the engine must never do that); imports that break the direction
`client → cards → engine → content`; state that is not plain serializable data or would not replay from the log;
nondeterminism (Date, Math.random, iteration over unordered sets that reaches game state); a Phaser scene holding game
state or rules; dead, duplicated or debug code; comments that are stale or claim an official ruling for what is an
owner decision; missing tests on a new primitive. Report at most the 15 findings that matter most, each with
file:line, what breaks and a concrete failing case, ranked by severity, and say which you verified by running
something and which you only read.

## Browser brief (pieces 13 to 15)

Read-only on the repo. Own Vite dev server on a confirmed-free port (5241, 5242, 5243), started and stopped by the
agent; never kill a process the agent did not start. Headless Chromium through Playwright with `--use-angle=metal`
and reduced motion. Driver scripts from the earlier passes are in the session scratchpad (`play-scenarios`,
`play-precons`, `play-campaign`); if that folder is gone, copy the helpers from `packages/client/e2e/`. Look at every
screenshot. Report defects with a repro and severity, kept apart from cosmetic notes.

## Card and encounter audit brief (pieces 1 to 9)

Repo: /Users/quincarter/Documents/Dev/marvel-champions-game, branch feature/wave-8 (pushed, clean). Follow CLAUDE.md. American spelling.

Hard rules

- Run NO git commands. Call no mcp__hearthbot__ tools.
- Do not edit any existing file. You may create exactly ONE new test file (named in your task) and nothing else in the repo.
- Other agents run at the same time on other packs; they also only add one new test file each.
- No `node:` imports in test files (the cards package has no node types).

What to do
For every card in your scope, compare the printed text in the content data (packages/content/src/data/<pack>/cards.ts; the text there is the card text, with provenance notes in provenance.ts where transcribed) against (1) the stats/keywords/traits in the same data and (2) the ability script under packages/cards/src/wave8/... Look for: a clause of text that the script does not implement; wrong timing word (Interrupt vs Response, Forced, "when" vs "after"); wrong form or phase gating (Hero/Alter-Ego Action, your turn only); wrong target scope (enemy vs minion vs villain, "you" vs "any player"); missing limits ("once per round/phase", "max 1 per player", Restricted, Unique); cost and resource-type checks; "up to"; "then" (the part after "then" only happens if the part before fully resolved, RRG 1.8 "Then"); keyword handling (Team-Up, Requirement, Uses, Piercing, Ranged, Overkill, etc.); and anything that only works in a solo game but breaks with two players.

Authorities, in order: the card's printed text; RRG 1.8 (grep the RRG markdown in the repo root; PDF mc_rulesreference_v18_compressed.pdf for page numbers via pypdf); FFG rulings in marvel-champions-rulings-post-rrg-1-7.md (cite by date heading); owner decisions in docs/phase7-wave8.md §4.1 (rows 1 to 90). An owner decision or an existing "built this way" note is NOT a defect; do not re-litigate rows already decided, but do say if the build does not match the row. Existing tests live next to each module; docs/phase7-wave8-rules-check.md and -2.md list what was already checked, so spend your time on what they did not cover.

How to prove
For each suspected mismatch, write a short real-engine test in your one new file (copy the setup pattern from the pack's existing tests). If the engine does the wrong thing, pin it with `it.fails` and a one-line comment citing the text/page. If your suspicion was wrong, keep the passing test only when it covers something no existing test covers; otherwise delete it. Do not fix scripts or the engine.

Finish
Run your file: `pnpm --filter @mc/cards exec vitest run <path relative to packages/cards>`; `pnpm exec oxlint <file>`; `pnpm exec oxfmt --check <file>`; `pnpm --filter @mc/cards exec tsc -p tsconfig.json --noEmit`.
Report under 300 words: cards audited (count), the defects found (card code, printed text clause, what the game does, severity, the `it.fails` name), the things you checked and found correct that had no test before, and unresolved rules questions as multiple choice with a recommended default. Keep official rules, owner decisions and your own interpretations clearly separate.
