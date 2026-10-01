# Wave 6 handoff (cycle 6 in our ids, Mutant Genesis)

For any session picking up the Wave 6 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as wave 5's
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review"), and CLAUDE.md "How
to split work across agents". Started 2026-10-01.

## Resuming

- **Branch:** `feature/wave-6`, off `main` at c3673bc5 (v0.14.0 + #92). Everything finished and verified is pushed
  there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave6-sources.md` and `docs/phase7-wave6.md` once
  they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC32 Mutant Genesis campaign in the same PR.

## Scope

Our `cycleId("cycle6")` (Core is `cycle1`); the packs' `Cycle` records still read "Cycle 6" and should be renamed to
"Mutant Genesis" when the wave is emitted. To be confirmed against RRG 1.8 Appendix VI by the sources doc.

| Pack      | Type          | Release (pack data) | Card data today                            |
| --------- | ------------- | ------------------- | ------------------------------------------ |
| `mut_gen` | Campaign box  | 2022-09 (to check)  | not emitted (curation file missing)        |
| `cyclops` | Hero pack     | 2022-09-30          | data only                                  |
| `phoenix` | Hero pack     | to check            | not emitted (curation `phoenix.ts` exists) |
| `wolv`    | Hero pack     | 2022-11-11          | data only                                  |
| `storm`   | Hero pack     | 2022-11-11          | data only                                  |
| `mojo`    | Scenario pack | 2022-11-11          | data only (MojoMania)                      |
| `gambit`  | Hero pack     | 2023-02-24          | data only                                  |
| `rogue`   | Hero pack     | 2023-02-24          | data only                                  |

## Known gaps for the hero-pack spec pass

- **Storm's Weather deck** (`storm` 36002–36005). The precon (3ada7537) still lists the four Weather supports in
  `storm-leadership`'s 44 cards; they belong in a separate Weather deck (printed list: 40 + 4 weather). Per the MC36
  Storm rules insert ("The Weather Deck"), it is shuffled facedown next to the identity, with no faceup top card, no
  discard pile and no reshuffle; setup chooses one Weather support into play, and Weather Control / Weather Goddess
  swap the in-play support with another from the deck (the supports are Permanent). Today
  `scripts/marvelcdb/normalize/separate-decks.ts` hardcodes Invocation's rules (`topCardFaceup: true`,
  `discardPile: "own"`, `whenEmpty: "reshuffleDiscardWithoutPenalty"`) and `createGame` builds only that kind. Needs:
  curation fields for those three, the engine building a no-discard facedown deck, and a swap primitive. Then move
  36002–36005 to `separateDecks` and the deck drops to 40.

## Agents running now

None yet.

## Decisions made by the user during the wave

None yet; the spec's §4.1 table will hold them.
