# Wave 7 handoff (cycle 7, NeXt Evolution)

For any session picking up the Wave 7 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as earlier waves
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review",
[phase7-wave6-handoff.md](phase7-wave6-handoff.md)) and CLAUDE.md "How to split work across agents". Started
2026-10-04.

## Resuming

- **Branch:** `feature/wave-7`, off `main` at 332a2959 (Wave 6, #94). Everything finished and verified is pushed
  there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave7-sources.md`, `docs/phase7-wave7-data-survey.md`
  and `docs/phase7-wave7.md` once they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC40 NeXt Evolution campaign in the same PR.
- **Order of work** (as waves 5 and 6): sources doc and data survey → spec (`game-rules-architect`, in passes: the box
  and campaign first, then the hero packs) → schema changes and `next_evol` emitted → engine primitives one at a time
  (one engine agent at a time) → scripting per hero / per scenario (≤ 3 agents, one small task each) → rules QA →
  custom decks → client wiring and Guided mode → campaign → progression → shipping.

## Scope

RRG 1.8 Appendix VI, "Limited Environment" (p. 71): "**7.** The _NeXt Evolution_ campaign expansion, the _Psylocke
Hero Pack_, the _Angel Hero Pack_, the _X-23 Hero Pack_, and the _Deadpool Hero Pack_." Our id is `cycleId("cycle7")`;
the four emitted packs' `Cycle` records still read "Cycle 7" and should be renamed "NeXt Evolution" when the wave is
emitted (as wave 6 did in 391e11cd).

| Pack        | Type         | Release (pack data) | Card data today                                            |
| ----------- | ------------ | ------------------- | ---------------------------------------------------------- |
| `next_evol` | Campaign box | to check            | not emitted (raw cache only, no `curation/next_evol.ts`)   |
| `psylocke`  | Hero pack    | 2023-09-22          | data only (`DATA_ONLY_*`), curation `psylocke.ts`          |
| `angel`     | Hero pack    | 2023-09-22          | data only, curation `angel.ts` ("zero curation" at ingest) |
| `x23`       | Hero pack    | 2023-11-17          | data only, curation `x23.ts`                               |
| `deadpool`  | Hero pack    | 2023-11-17          | data only, curation `deadpool.ts`                          |

The box (MC40): heroes Cable and Domino; five scenarios; 14 campaign cards (PLAN.md C3). Rulebook:
`docs/campaign-modes/mc40_next_evolution_rulebook-web.pdf`, markdown `docs/campaign-modes/markdown/mc40_next_evolution.md`.
The RRG has NeXt Evolution FAQ sections (`mc_rulesreference_v18_compressed.md` lines ~4652 and ~5086).

Already in the repo:

- Raw MarvelCDB caches: `packages/content/raw/marvelcdb/{next_evol,psylocke,angel,x23,deadpool}.json`.
- Hero art: `art/heroes/{41001a-psylocke,42001a-angel,43001a-x-23,44001a-deadpool}/`; Cable and Domino wait in
  `art/heroes/_pending/{40001a-cable,40037a-domino}/`, both empty (asked for on the PR).
- Campaign art: `art/campaigns/next_evol/{artboards,rulebook}/`.
- Carried over from wave 6's handoff: the `next_evol` scenario obligations will be emitted with `encounterSetIds: []`
  unless the normalizer fix made for `mut_gen` / `mojo` is applied to them too.

## Release

Wave 6 (#94) is merged but not released yet (`changie next auto` = v0.16.0 on 2026-10-04). Wave 7 is a minor release
after that; check `changie next auto` before merging.

## State (2026-10-04, end of the first day)

The PR's checklist is the live record; this is the short version.

- **Spec:** `docs/phase7-wave7.md` is complete (§3.1–§3.87, §8 build order). All 53 questions are answered by the
  owner (§4.1); eleven differ from the proposed defaults and five are the owner's own definitions.
- **Card data:** all five packs are emitted and exported as `WAVE7_*`, in `PLAYABLE_CARDS` but listed in
  `UNSCRIPTED_WAVE7_PACKS` (nothing is scripted). Six starter decks, all verified against printed lists.
  `NEXT_EVOL_CAMPAIGN` exists but is not in `CAMPAIGNS`.
- **Engine queue (§8.2, 50 tasks, one engine agent at a time):** tasks 1–3 are in (player side schemes: icons, entering
  play by an effect, the limit). Task 1b (Q2: a When Defeated with no player as its source) was added. Next: 4
  (assault), 5 (`costPerPlayer`), then §8.2's order.
- **Each engine task's brief:** the §8.2 row, the §3 row to read (by `awk` between headings, never the whole spec),
  the owner decisions that apply, "search and reuse", exact-number tests in a colocated file, no git, and the suites
  run alone one after another. The main session reruns engine and cards before committing.

## Agents running now

One at a time for engine work; see the PR's handoff section for which task. Agents do not commit: an uncommitted
change in the working tree is unverified agent output.

## Lessons so far

- The tracker's sources draft listed one ruling of ten. Match every card title in the packs' raw data against the
  rulings file by script instead of trusting a hand search.
- The RRG markdown conversion can put a page's entries under the wrong product heading (column order on p. 69).
  Check the PDF page when an errata or FAQ entry names a card the pack's raw data doesn't have.

## Decisions made by the user during the wave

None yet.

## More lessons (2026-10-04)

- Overlapping vitest runs make the long e2e and simulation tests time out. Run the suites alone, one after another.
- A re-emit picks up whatever parser or normalizer work is uncommitted in the tree. Do not re-emit a pack while a data
  agent is mid-change, or review the extra diff as that agent's work.
- A new game rule can make an older test's setup illegal (two player side schemes with two players). Move the test's
  setup; do not weaken the rule.
- Agent reports about printed cards were wrong more than once (an icon misread as physical, "printed equals current"
  for two errata). Read the scan before accepting a correction either way.
