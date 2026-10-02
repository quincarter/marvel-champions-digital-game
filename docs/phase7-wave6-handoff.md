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

- **Obligation keyword parsing** (25edb354, for Paparazzi's Hinder and Watch Me Play's Incite/Peril): keyword
  sentences before an obligation's first header now parse as keywords. On the next regen this also gives Shuri's
  obligation (`bp`, "Uses (4 doubt counters). Victory 0.") and Falcon's ("Uses (3 emergency counters)") real `uses` /
  `victory` keywords. Neither pack has been regenerated, so nothing changed yet; whoever regenerates `bp` must check
  Shuri's obligation script doesn't then place its counters twice.
- **`curation/types.ts` comments** from 25edb354 show a mojibake `Â§` for `§` (cosmetic).

- **Expert villain versions' stage numbers.** MaGog's record (and Mansion Attack's, the same shape) says expert
  `villainStages: [1, 1]`, but the one-stage expert cards (39001b, 32121b–32124b) carry `stageNumber: 2`.
  `wave6Scenario` (1e11e7b4) uses the card's own first/last stage. Fix the record or the card numbering when MaGog or
  Mansion Attack is scripted.
- **`WAVE6_CARDS` in `@mc/cards`** appends the wave's packs because `PLAYABLE_CARDS` doesn't include them yet; remove
  that spread when content's `WAVE6_*` exports join `PLAYABLE_CARDS`, or every wave 6 card is counted twice.

- **§3.19 follow-ups** (main scheme stage into the victory display): an advance run from inside a When Revealed (Mansion
  Attack 1B) still resolves the earlier stage's starting-threat placement and `mainSchemeAdvanced` after the new
  stage's (harmless for 1B, whose values are dashed); `keywordValueSum` reads card-level keywords only, so a
  stage-level Victory keyword wouldn't count (none is printed today).
- **Client log lines owed:** `healBlocked` (§3.12), `boostWithheld` (§3.15); `mainSchemeStagesShuffled` (§3.18)
  carries the hidden order and must never be shown.

- **Teamwork / quickstrike follow-ups** (2a1df964): flipping a card to a minion face and `putIntoPlayFacedown` trigger
  neither keyword (as quickstrike today); `quickstrikeAttack` reads keywords without `deps`, so a granted quickstrike
  is missed.
- **Clea** (`wave1/drs/pack-cards.ts`) is scripted as `instead(moveCards deckShuffle)`, so her defeat never completes
  and Operation Zero Tolerance doesn't take her (FAQ #104 names "shuffled into a player's deck"). Likely needs
  `setDefeatDestination("deckShuffle")` as Regroup uses; check before changing a wave 1 card.
- **Scenario obligations with no encounter set** (cross-wave): the normalizer gave every non-campaign obligation
  `encounterSetIds: []`. Fixed for `mut_gen` and `mojo` in this wave; still to regenerate: `sm` 27132, `toafk`
  11018–11021 and 11049, and the data-only `aoa`, `aos`, `cw`, `next_evol`, `synthezoid` obligations.
- **Boom Boom** (32090, Project Wideawake Captive ally) needs a per-target damage amount: no §3 row yet.

- **New engine row needed: an ally attached to a scheme** (Robert Kelly 32066 on Find the Senator, Sabretooth e6a4ef05):
  `checkDefeats` (`resolve/defeat.ts`) sweeps only allies in a player's play area, so lethal damage never defeats an
  attached Kelly (Stalked by Sabretooth can't lose the game while he's attached: pinned `it.fails` in
  `sabretooth.test.ts`); and a player card can't target him while attached ("no valid target"). Queue it as §3.75
  after Nimrod (§3.4).
- **Sabretooth notes:** `completeMainScheme` ends the game on the final stage before When Completed runs (32064b's
  Defeat Kelly is pinned structurally); `canHaveAttached` isn't exported from `@mc/engine`; `wave6Scenario` now drops
  32065b as a separate card (`withoutBackFaces`).

- **New engine row needed: "the topmost X in the encounter discard pile"** (Sentinel Mark VIII 32114, Master of
  Magnetism 32151): `encounterCards.top` only limits a deck, so a selector attaches every matching card. Needs e.g.
  `encounterCards.topmostOnly`. Wave 2's Zola's Experiments (`wave2/trors/zola.ts`, 04124) uses the same selector and
  probably attaches every match today; its test only checks the ref exists. Queue as §3.76.

- **New engine row needed: an identity-scoped "cannot thwart"** (Wrapped in Metal 32148-ish, "Attached identity cannot
  thwart"): c84834d7 uses `basicThwartOnlyAgainst` with no scheme, which blocks the basic thwart only; the identity can
  still resolve a thwart event or ability. Queue as §3.77.

- **New engine row needed: a resource counted per status card** (Titanium Muscles 32005, "for each tough status card"):
  `generatesPerCard` counts cards in play only. Queue as §3.78. (Spec §4.1's row pointing this at wave 4 §3.38 is wrong.)
- **Engine gap: an interrupt offered when its cost can't be paid** (Nightcrawler 32011's energy cost): the offer check
  doesn't test payability; it is offered, then fails at payment. Probably cross-wave; check `candidatesFor` against how
  actions test costs.

- **Mutant Protectors (FAQ #17) engine gaps** (`mut_gen/precon-player-cards.ts`): a defense-labelled play also announces
  `defended` for the hero while the ally defends (pinned `it.fails`); "the ally leaves play before damage → the hero
  becomes the defender" is an `it.todo` (the attack still resolves against the departed ally). Powerful Punch's
  mass-form flip timing (FAQ #14) is left for Shadowcat's e2e. `colossus/cross-hero.test.ts`'s "no script yet" comment
  for 32014–32018/32021 is stale.

## Agents running now

None yet.

## Decisions made by the user during the wave

None yet; the spec's §4.1 table will hold them.
