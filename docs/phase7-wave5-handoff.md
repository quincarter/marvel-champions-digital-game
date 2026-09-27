# Wave 5 handoff (cycle 4, Sinister Motives)

For any session picking up PR #64, local or cloud. The PR body has the checklist and the "Remaining plan"; the spec
is [phase7-wave5.md](phase7-wave5.md) (rulings table §4.1, including the Q67 survey). This page carries what used to
live only in a local Claude memory note: how to resume, the decisions the user made during the wave, and the lessons
from running several agents in one worktree. Updated 2026-09-27.

## Resuming

- **Branch:** `feature/wave-5`. Everything finished and verified is on it.
- **Old work in progress (consumed):** `wip/wave-5-stopped-agents` is one commit on top of `feature/wave-5` 49b9535e holding the
  uncommitted files of three agents stopped at the weekly usage limit on 2026-09-27 11:50. It is untested; never merge
  it as is. To continue a piece, check out its files from that branch into a `feature/wave-5` checkout, finish and test
  them, and commit them to `feature/wave-5`:
  - **Q67 batch 1:** older "activates against" effect scripts converted to `enemyActivates`
    (`wave2/scw/obligation-nemesis`, `wave2/toafk/kang-encounter-set`, `wave2/trors/crossbones`,
    `wave4/mts/tower-defense`, each with its test). Loki's The Trickster (`wave4/mts/loki.ts`) not started. The test
    files were not yet run in full; the Kang test had a TS2379 `difficulty` error mid-edit.
  - **The Sinister Six part 1:** `buildSmMultipleVillains` in `wave5/setup.ts`, `wave5/sm/sinister-six/`, and its line
    in `wave5/sm/index.ts`. Tests not run.
  - **Q70** (Induced Panic) wrote nothing; start it over.
- **Agent branches in flight (seventh session, 2026-09-27 ~22:00 UTC):** each agent pushes its own branch after
  every commit; the main session reviews, reruns the tests and cherry-picks onto `feature/wave-5`, then deletes the
  branch. If a session ends first, these hold the unmerged work (untested until reviewed):
  - `wip/wave5-manipulated-mind` (`game-rules-architect`): a `treatAsMinion` primitive (mirror of Karma's
    `treatAsAlly`), 27171's lowest-cost-ally `attachesTo`, then Manipulated Mind in `modulars/whispers-of-paranoia.ts`.
    Old Grudge landed (attachments without "attach to" text attach from their own When Revealed).
  - `wip/wave5-sinister-assault` (`ability-scripting-engineer`): Sinister Assault in `cards/src/wave5/sm/modulars/`.
  - Still blocked (engine work, not started): Advanced Glider 27136's
    Hero Action needs a cost "discard hand cards with a combined resource cost of 3 or more" (`GOBLIN_GEAR_SKIPPED`).
    Osborn Tech scripts three Hero Action costs as effects (Arm Cannon, Kinetic Armor, Neocarbon Scales): no cost
    shape for a superlative discard, indirect damage or giving the villain cards.
  - Fallen Warrior (`mts` 21153) has Old Grudge's bug: its data's `impliedAttachHost: "ally"` attaches it at reveal
    before its own When Revealed; switch it to `"ownWhenRevealed"` and regenerate `mts` (not started).
  - Open question to the user: Old Grudge with the nemesis minion already in play is discarded (scripted default).
  - Already on `feature/wave-5`, safe to ignore or delete: `wip/wave5-cannot-thwart-side`,
    `wip/wave5-venom-goblin-villain`, `wip/wave5-venom-goblin-encounter`, `wip/wave5-venom-goblin-integration`, `wip/wave5-q71-step-one`, `wip/wave5-down-to-earth`, `wip/wave5-whispers-of-paranoia`, `wip/wave5-goblin-gear`, `wip/wave5-osborn-tech`, `wip/wave5-search-primitives`, `wip/wave5-old-grudge`, `wip/wave5-guerrilla-tactics`, `wip/wave5-venom-goblin-setup`, `wip/wave-5-ambush-fallback` (the sixth
    session's Ambush! fallback, cherry-picked 683bb5c/d3ab39a), `wip/wave-5-five-villains` (superseded by 13f9b13).
    The cloud proxy refuses remote branch deletion, so they stay until someone deletes them on GitHub.
- **Order of the rest:** the PR body's "Remaining plan".

## Rules for agents (also in CLAUDE.md)

- One small task per agent: one engine primitive or ruling, one card group, one scenario, one modular set. Scripting
  per hero: identity, then events | supports/upgrades/allies | obligation + nemesis in parallel, then precon e2e with
  the cross-hero test (`packages/cards/src/testing/cross-hero.ts`). At most 3 agents at once; one engine agent at a time
  (they share `spec.ts`, `select.ts`, `resolve/*`).
- In a shared worktree: stage explicit paths only, never `git add -A`, `stash`, `reset`, `clean`, `checkout <sha>` or a
  detached HEAD; commit with `--no-verify` (lint-staged's stash-and-restore has swept other agents' files into commits);
  a module goes in the same commit as its import line.
- `git commit -- <path>` commits the path's whole working-tree content, not only the staged hunks. For a file several
  agents edit, stage with `git add -p` and commit without a pathspec after checking `git diff --cached`.
- The main session never stages in the shared index while agents run. A repair commit is built from a temporary index
  (`GIT_INDEX_FILE=… git read-tree HEAD`, `update-index`/`add`, `write-tree`, `commit-tree`) and moved onto the branch
  with `git update-ref <ref> <new> <expected-old>`.
- Commits carry no Claude co-author trailer. Each change gets a changie fragment; `sleep 1` between `changie new` calls.
- A box on the PR is ticked only after the main session has read the tests and run them, never on an agent's report.

## Lessons from review

- **Assert the exact printed effect.** Swinging Assault's test passed on "damage went up" while its extra boost card
  never counted (fixed by Q66). Briefs now require assertions that can tell the right behavior from a near miss.
- **Effects after `enemyAttack` in one list run after the attack resolves** (RRG 1.8 "Activation", p. 6). Anything
  meant to apply during it uses `applyRuleUntil`'s `attack: "initiated"` (Q59) or the activation-scoped options (Q66).
- **Check the card scan when MarvelCDB text looks wrong.** Scans are at `assets/card-art/bundles/cards/<id>.png`.
  Now or Never, Deepest Fears, Slice and Dice, Induced Panic, Rhino, Skies Over New York and Tracking Display were all
  MarvelCDB transcription defects, fixed in `packages/content/scripts/marvelcdb/curation/sm.ts`.
- **Expert mode always adds the Expert encounter set** (RRG 1.8 Expert Mode), even when a box's Setup prints only
  "Standard". The `sm` scenario records now list Core's Standard and Expert sets.
- **Cross-hero tests seat one copy of the card under test.** With three copies, a second one in the opening hand made a
  discard step throw away the tracked copy (Jump Flip).
- **Agent reports aren't always right:** a report once claimed the main session had "confirmed" failures it hadn't; a
  tracker agent missed rulings and invented one. Check the claim before acting on it.

## Decisions made by the user during the wave

The full table is spec §4.1. The ones settled in conversation rather than in a planned question:

- **Q67 (2026-09-27):** "X activates against you" attacks if that player is in hero form and schemes if in alter-ego
  (RRG 1.8 "Activation", p. 6); "when X activates against you" matches both.
- **Custom decks (2026-09-26/27):** each wave proves its cards outside their precons
  ([wave-definition-of-done.md](wave-definition-of-done.md) §4b, [custom-deck-testing.md](custom-deck-testing.md)).
  Backfills in PLAN.md Phase 6: every Core–wave 4 aspect/basic card from another hero's deck, at least one real
  MarvelCDB decklist per hero (fetching from marvelcdb.com approved), random-deck coverage.
- **Evil Doppelgänger (Q69):** counts any identity-specific card in the engaged player's hand (RRG 1.8 p. 23).
- **Scenario intros from the rulebook art (2026-09-27):** a one-off (non-campaign) game's intro reuses the box's own
  captured rulebook comic page (`art/campaigns/<box>/rulebook/page_NNN.jpg`, rendered by `extract-artboards`) instead
  of new art, for every box, not only `sm`. For `sm` the page before each scenario's Setup page is its intro: Sandman
  p. 8, Venom p. 10, Mysterio p. 12, The Sinister Six p. 14 (checked: the Six vs Miles and Ghost-Spider), Venom Goblin
  p. 16 (the others inferred from MC27's Setup pages 9/11/13/15/17). Those pages are already lettered, so the intro
  shows the page with panel beats but no bubbles of its own. Needs the client to load `rulebook/` for intros (today
  `campaign-art.ts`'s glob skips it) and `scenario-intros.ts` to point at a box page; step 5 work.
- Content drops (villain art, scenario and campaign music) are held in `_pending` folders until step 5/6; the PR's
  "Content to add" list says where each goes.
