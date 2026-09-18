# Phase 4 screen gaps: fan-out handoff

Working notes for the parallel run of [phase4-screen-gaps.md](phase4-screen-gaps.md), started 2026-09-17. If a session dies (usage limit, crash), this is how to pick up. Delete this file once everything is merged.

## Integration branch

`feature/phase4-screen-gaps`, branched from `main` at `076cf85`, checked out in the main repo directory. Baseline there was green: content 268, engine 507, cards 441, client 554 tests; `pnpm typecheck` clean. Everything below merges into this branch. Nothing has been pushed and no PR is open.

## Wave 1 (launched 2026-09-17)

| Workstream | Agent type | Where it works | Branch | Commits? |
|---|---|---|---|---|
| **W1** Deck analysis (Deck check scene, builder stats panel, type/aspect filters, Preconstructed/Clear) | `game-client-engineer` | main repo dir, **uncommitted in the working tree** | `feature/phase4-screen-gaps` | **Done and committed** on the integration branch (client 554 → 580 tests). Browser check still owed. |
| **S5** Engine queries: `stackEntries`, `preview()`, `schemeResolved`, `plannedAttackDamage` + `defendPreview`, `explainQuery` + `choiceExclusions`, and the `concede` command / `conceded` outcome | `game-rules-architect` | `.claude/worktrees/agent-a60d2333f66c689c0` | `worktree-agent-a60d2333f66c689c0` | **Done and merged** into the integration branch (engine 507 → 556). Concede wired into Pause. |
| **W2** Title menu + setup flow (Scenario select, Take your seats, Table setup) | `game-client-engineer` | `.claude/worktrees/agent-a823678c74b964cea` | `worktree-agent-a823678c74b964cea` | **Done and merged** (client → 735). Conflicts with W1/W4/W9 resolved; Settings, Deck check and Play-this-deck seams wired. |
| **W4** Pause & Rules, Settings, menu button, and S7's read-only replay board if it fits | `game-client-engineer` | `.claude/worktrees/agent-a7a89ad77a61b012c` | `worktree-agent-a7a89ad77a61b012c` | **Merged into the integration branch** (client 580 → 625 tests). Fidelity pass against D13/P16/L07 still owed. |
| **W9** Decks & Collection layout (launched after W1 landed) | `game-client-engineer` | `.claude/worktrees/agent-a3784f22ee36a3677` | `worktree-agent-a3784f22ee36a3677` | **Done and merged** (client → 668). Touches `scenes/title.ts` additively (`TitleSceneData`/`withSeatOne`) — expect a conflict with W2. |
| **W5** Targeting panel (wave 2, launched after S5 merged) | `game-client-engineer` | `.claude/worktrees/agent-a79c9a010099fa40d` | `worktree-agent-a79c9a010099fa40d` | Commits at the end. Must contain `578fab8`. |
| **W6** Defend choice (wave 2) | `game-client-engineer` | `.claude/worktrees/agent-a1f59c5d76777c36c` | `worktree-agent-a1f59c5d76777c36c` | **Done and merged** (client → 803). |
| **W7** Villain phase breakdown (wave 2) | `game-client-engineer` | `.claude/worktrees/agent-a604b8b968959cb52` | `worktree-agent-a604b8b968959cb52` | Commits at the end. Must contain `578fab8`. |
| **W1+W4 fidelity pass** (Deck check, builder, Pause, Rules, Settings, menu button vs D04/P04/D13/P16/L07) | `game-client-engineer` | `.claude/worktrees/agent-ad47bbda9045a2306` | `worktree-agent-ad47bbda9045a2306` | Commits at the end. Must contain `38c5aea`. |
| **W3** Setup deal & mulligan (launched after W2 and W6 merged) | `game-client-engineer` | `.claude/worktrees/agent-aff2298a3f248bd4f` | `worktree-agent-aff2298a3f248bd4f` | Commits at the end. Must contain `f6c67b6`. |

The worktree agents were told **not** to edit `docs/phase4-screen-gaps.md`; each ends its report with a paste-ready "Landed" note. If a report was lost, reconstruct the note from the branch's diff.

### Picking up an interrupted agent

1. `git -C <worktree> status --short` and `git -C <worktree> log --oneline main..HEAD` to see what exists.
2. In that worktree: `pnpm install` if needed, then `pnpm typecheck && pnpm test`. If green, commit what's there and treat the workstream as partly landed; compare against its checklist in `phase4-screen-gaps.md` §3 (or S5.10 for the engine).
3. Start a fresh agent of the same type on the remainder, pointed at the same worktree path (not a new worktree), with the same rules: don't edit the gaps doc, commit on the worktree branch, don't push.

## Design fidelity (added 2026-09-17, after the first wave was cut off)

The user flagged that the built screens carry the fonts and componentry from the canvases but not their look and feel. Cause: no agent could *see* the `.dc.html` canvases. Fix: `scripts/render-design-canvases.sh` → `docs/design-renders/` (gitignored, regenerate per checkout) and the procedure in `docs/design-reference.md`. Every remaining and resumed workstream is briefed with it. **W1 and W4 landed before this existed and each owes a fidelity pass** (their screens vs. D04/P04/D14 and D13/P16/L07) — schedule those as follow-ups after their merges, before wave 2.

## Status after the usage-limit cut-off (2026-09-17 evening)

- **S5**: all six steps done and merged; its Implemented note is in the gaps doc. Pause's Concede is wired to the real command.
- **W4**: merged into the integration branch (conflicts in `main.ts`/`screen-focus.test.ts` were additive); report lost — its commit message is the report. Concede dispatch is isolated behind `PauseOverlay#dispatchConcede`; Settings is its own scene/key; the replay board was assessed as not safely landable and the "jump to a moment" list is drawn unavailable.
- **W2**: done and merged; note pasted into the gaps doc; the three cross-workstream seams are wired.
- **W9**: done and merged; note pasted into the gaps doc.

## Merge plan

Order: **W1** (commit the working tree on the integration branch first) → **S5** → **W4** → **W2**. Expected conflicts are small and additive: `scenes/keys.ts`, `view/screen-focus.ts` (+ test), `main.ts` (scene registration), `content/pool.ts` (both W2 and W4 touch it).

All cross-workstream stubs (Settings, Deck check, Concede, Play this deck) are wired as of the W2 merge.

Then `pnpm test && pnpm typecheck`, check the new screens in a browser (Vite from Bash — see the worktree-preview memory; agents were given ports 5183/5184/5185), paste the Landed notes into `phase4-screen-gaps.md`, tick boxes, update §1's inventory.

## Wave 2

W5, W6, W7 launched 2026-09-17 evening (table above). Still to launch, from the integration branch:
- ~~W1 + W4 fidelity passes~~ — launched as one agent (table above).
- **W8** Board/Inspect/Game Over follow-ups (menu button comes with W4; "Watch the replay" needs W4's read-only board).
- Then a `rules-qa-engineer` pass over S5.11's test list.

## §4 decisions taken for this run

- Concede is an **engine outcome** (S5.9's recommendation).
- Skipped, boxes left open: advice text, scenario/hero blurbs (data only), auto-resolve/auto-defend, pass-and-play, hex seed display, owned-card tracking. Heroic difficulty is left out.

## Unrelated worktrees (pre-existing, not part of this run)

- `loving-fermi-3a5772` — uncommitted choice/board-model edits, branch has no commits ahead of main.
- `pensive-heisenberg-8a3e36` — uncommitted Core card-script edits (aggression, She-Hulk), no commits ahead.
- `refactor-board-scene-d7b5ff` — 2 commits ahead of main ("Refactored board.ts"), unmerged. W4 was told to look at it for a replay seam but not to merge it wholesale.
