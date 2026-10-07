# Wave 8 handoff (cycle 8, Age of Apocalypse)

For any session picking up the Wave 8 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as earlier waves
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review",
[phase7-wave6-handoff.md](phase7-wave6-handoff.md), [phase7-wave7-handoff.md](phase7-wave7-handoff.md)) and CLAUDE.md
"How to split work across agents". Started 2026-10-07.

## Resuming

- **Branch:** `feature/wave-8`, off `main` at fc43e790 (v0.17.0, #102; Wave 7 is #98). Everything finished and
  verified is pushed there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave8-sources.md`, `docs/phase7-wave8-data-survey.md`
  and `docs/phase7-wave8.md` once they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC45 Age of Apocalypse campaign in the same PR.
- **Order of work** (as waves 5 to 7): sources doc and data survey → spec (`game-rules-architect`, in passes: the box
  and campaign first, then the hero packs) → schema changes and `aoa` emitted → engine primitives one at a time (one
  engine agent at a time) → scripting per hero / per scenario (≤ 3 agents, one small task each) → rules QA → custom
  decks → client wiring and Guided mode → campaign → progression → shipping.

## The push hook (owner's request relayed 2026-10-07, not yet in effect)

The request for this wave: skip the e2e pre-push gate (`.githooks/pre-push`) for this branch's pushes while the wave
is being built, keep the commit hooks (`pre-commit` lint and format, `commit-msg`), and run `pnpm check` before every
push. **It is not in effect yet:** the session's permission settings refused a hook-skipping push without the owner's
own word, so pushes go through the hook as usual until the owner confirms on the PR thread or in the session. A push
that changes nothing under `packages/` or `pnpm-lock.yaml` (docs, changelog fragments) does not run the suite anyway.

**If the gate is skipped, it comes back before the wave ships.** From the first client push of step 5's final pass,
and for every push after it up to the merge and the release to prod, the whole Playwright suite must have passed on
what goes up (`pnpm e2e:verify` runs it ahead of time). The PR's step 8 carries a box for this.

## Rules policy (owner, 2026-10-07)

Where an official FFG ruling says a card's printed wording gives a result the designers did not intend, the intended
behavior is built, and the spec's §4.1 row cites the ruling by its date heading with the RRG page it clarifies.
Where a ruling and the RRG disagree with no statement of intent, the conflict goes to the owner as a short
multiple-choice question with a recommended default.

## Scope

RRG 1.8 Appendix VI, "Limited Environment" (p. 71): "**8.** The _Age of Apocalypse_ campaign expansion, the _Iceman
Hero Pack_, the _Jubilee Hero Pack_, the _Nightcrawler Hero Pack_, and the _Magneto Hero Pack_." Our id is
`cycleId("cycle8")`; the four emitted packs' `Cycle` records should be renamed "Age of Apocalypse" when the wave is
emitted (as waves 6 and 7 did).

| Pack       | Type         | Raw cards | Card data today              |
| ---------- | ------------ | --------- | ---------------------------- |
| `aoa`      | Campaign box | 195       | not emitted (raw cache only) |
| `iceman`   | Hero pack    | 32        | data only (`DATA_ONLY_*`)    |
| `jubilee`  | Hero pack    | 40        | data only                    |
| `ncrawler` | Hero pack    | 38        | data only                    |
| `magneto`  | Hero pack    | 42        | data only                    |

The box (MC45): heroes Bishop and Magik; five scenarios (villains in the raw data: Unus, the Four Horsemen (War,
Famine, Pestilence, Death), Apocalypse, Dark Beast, and En Sabah Nur as a set); 6 campaign cards per PLAN.md C3, to be
checked by the data survey. Encounter sets named in the raw data: Age of Apocalypse, Apocalypse, Blue Moon, Celestial
Tech, Clan Akkaba, Dark Beast, Dark Riders, Dystopian Nightmare, En Sabah Nur, Four Horsemen, Genosha, Hounds,
Infinites, Mission, Overseer, Savage Land, Standard III, Unus, plus Campaign and the two nemesis sets. Rulebook:
`docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf`, markdown `docs/campaign-modes/markdown/mc45_age_of_apocalypse.md`.
The RRG has Age of Apocalypse FAQ sections (`mc_rulesreference_v18_compressed.md` lines ~4682 and ~5058).

Already in the repo:

- Raw MarvelCDB caches: `packages/content/raw/marvelcdb/{aoa,iceman,jubilee,ncrawler,magneto}.json`.
- Hero art: `art/heroes/{46001a-iceman,47001a-jubilee,48001a-nightcrawler,49001a-magneto}/`; Bishop and Magik wait in
  `art/heroes/_pending/{45001a-bishop,45030a-magik}/`, both empty (asked for on the PR).
- Campaign art: `art/campaigns/aoa/rulebook/` (8 pages); `artboards/` is empty.
- Carried over from earlier waves: a box's scenario obligations are emitted with `encounterSetIds: []` unless the
  normalizer fix made for `mut_gen` / `mojo` is applied to them too; a full re-emit drifts in unrelated fields (image
  extensions, core's sets and `maxPerHost`), so emit pack by pack.

## Release

`main` is at v0.17.0 with no unreleased fragments (2026-10-07). Wave 8 is a minor release (v0.18.0 unless something
else ships first); check `changie next auto` before merging.

## State

The PR's checklist is the live record.

## Lessons carried in

- Match every card title in the packs' raw data against the rulings file by script instead of trusting a hand search.
- The RRG markdown conversion can put a page's entries under the wrong product heading; check the PDF page.
- Agents do not commit unless told to: an uncommitted change in the working tree is unverified agent output. One
  engine agent at a time; at most three agents in all, on files that do not overlap.
