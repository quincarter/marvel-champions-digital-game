# Wave 9 handoff (cycle 9, Agents of S.H.I.E.L.D.)

For any session picking up the Wave 9 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as earlier waves
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review",
[phase7-wave8-handoff.md](phase7-wave8-handoff.md)) and CLAUDE.md "How to split work across agents". Started
2026-10-09.

## Resuming

- **Branch:** `claude/project-thread-fu5eqf`, off `main` at 1a7290af (v0.18.0, #107; Wave 8 is #103, merged
  2026-10-09). Everything finished and verified is pushed there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave9-sources.md`, `docs/phase7-wave9-data-survey.md`
  and `docs/phase7-wave9.md` once they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC50 Agents of S.H.I.E.L.D. campaign in the same PR.
- **Order of work** (as waves 5 to 8): sources doc and data survey → spec (`game-rules-architect`, in passes: the box
  and campaign first, then the hero packs, then Trickster Takeover) → schema changes and `aos` / `tt` emitted →
  engine primitives one at a time (one engine agent at a time) → scripting per hero / per scenario (≤ 3 agents, one
  small task each) → rules QA → custom decks → client wiring and Guided mode → campaign → progression → shipping.
- **The e2e pre-push hook stays on** for this wave. `pnpm check` runs before every push.

## Rules policy (owner, 2026-10-07, carried over)

Where an official FFG ruling says a card's printed wording gives a result the designers did not intend, the intended
behavior is built, and the spec's §4.1 row cites the ruling by its date heading with the RRG page it clarifies.
Where a ruling and the RRG disagree with no statement of intent, the conflict goes to the owner as a short
multiple-choice question with a recommended default. Known bugs are fixed in the wave, not left as expected-fail
tests.

## Scope

RRG 1.8 Appendix VI, "Limited Environment" (p. 71): "**9.** The _Agents of S.H.I.E.L.D._ campaign expansion, the
_Black Panther Hero Pack_, the _Silk Hero Pack_, the _Falcon Hero Pack_, and the _Winter Soldier Hero Pack_." Our id is
`cycleId("cycle9")`; the four emitted packs' `Cycle` records should be renamed "Agents of S.H.I.E.L.D." when the wave
is emitted. The owner also asked for the Loki scenario pack, **Trickster Takeover** (`tt`, released August 15, 2025
per its Hall of Heroes page), to ship with this wave, as MojoMania shipped with wave 6.

Counts are top-level records in the raw MarvelCDB cache (fetched 2026-09-13), counted by script on 2026-10-09.

| Pack     | Product                      | Type          | Raw cards | Card data today              |
| -------- | ---------------------------- | ------------- | --------- | ---------------------------- |
| `aos`    | Agents of S.H.I.E.L.D., MC50 | Campaign box  | 195       | not emitted (raw cache only) |
| `bp`     | Black Panther (Shuri)        | Hero pack     | 42        | data only (`DATA_ONLY_*`)    |
| `silk`   | Silk                         | Hero pack     | 38        | data only                    |
| `falcon` | Falcon                       | Hero pack     | 42        | data only                    |
| `winter` | Winter Soldier               | Hero pack     | 37        | data only                    |
| `tt`     | Trickster Takeover           | Scenario pack | 66        | not emitted (raw cache only) |

420 cards in all.

**The box (MC50):** heroes Maria Hill (50001a) and Nick Fury (50034a); five scenarios with villains Black Widow,
Batroc, M.O.D.O.K., Citizen V (the Thunderbolts) and Baron Zemo; nine evidence cards (three each of means, motive and
opportunity, a card type the schema does not have yet). Encounter sets in the raw data: Black Widow, Batroc, M.O.D.O.K.,
Thunderbolts, Baron Zemo, A.I.M. Abduction, A.I.M. Science, Batroc's Brigade, Scientist Supreme, Gravitational Pull,
Hard Sound, Pale Little Spider, Power of the Atom, Supersonic, The Leaper, S.H.I.E.L.D., S.H.I.E.L.D. Executive Board,
Executive Board Evidence, plus the two nemesis sets. New keyword per Hall of Heroes: Vulnerable. Rulebook:
`docs/campaign-modes/mc50_rulebook-web.pdf`. The RRG has Agents of S.H.I.E.L.D. FAQ and errata sections
(`mc_rulesreference_v18_compressed.md` lines ~4698 and ~5124).

**Hero packs:** each brings one hero, a nemesis set and one modular set: `bp` Extreme Risk, `silk` Growing Strong,
`falcon` Techno, `winter` Whiteout. `bp` and `silk` carry player side schemes.

**Trickster Takeover:** two scenarios. Enchantress (three stages, main schemes Prime Real Estate and Sovereign
Sorceress) and Loki, God of Lies (the God of Lies villain plus four Loki / Fading Figment double-sided villains, main
schemes Worlds Collide and Mischief and Mayhem; single-table and epic multiplayer per Hall of Heroes), and the
Trickster Magic modular set. FFG rulings that name it: February 28, 2026 (3), March 19, 2026 (2), June 25, 2026 (5),
and the Enchantress entries near line 534 of the rulings file.

Already in the repo:

- Raw MarvelCDB caches: `packages/content/raw/marvelcdb/{aos,bp,silk,falcon,winter,tt}.json`.
- Hero art folders waiting, to be checked by the data survey: `art/heroes/_pending/{50001a-maria-hill,50034a-nick-fury}/`.
- Carried over from earlier waves: a box's scenario obligations are emitted with `encounterSetIds: []` unless the
  normalizer fix made for `mut_gen` / `mojo` is applied to them too; a full re-emit drifts in unrelated fields (image
  extensions, core's sets and `maxPerHost`), so emit pack by pack. Card art is WebP q72 via
  `mise run card-art-compress`, committed once, never in CI.

## Release

`main` is at v0.18.0 (2026-10-09). Wave 9 is a minor release (v0.19.0 unless something else ships first); check
`changie next auto` before merging.
