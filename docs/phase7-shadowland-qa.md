# Shadowland (MC65) rules QA, 2026-10-22

Scope: `docs/phase7-shadowland.md` section 6 "QA". Sources in authority order: RRG 1.8 (page numbers printed), the
insert (`docs/campaign-modes/markdown/mc65_shadowland.md`, "insert p. N"), then the printed card text in
`packages/content/src/data/shadowland/cards.ts`. No FFG ruling on Shadowland exists. Printed copies: SITN 13, Dark
Protege 16, Ninja Swarm 9, Shadow Labyrinth 11, Deadly Contraptions 11, Heart of Shadow 17, Black Flower 13 = 90. The
data holds 85 quantity-units because each two-stage main scheme pair is one record; every printed copy is audited below.
Card text is taken as transcribed (not re-checked against scans).

Evidence: `packages/cards/src/wave11/shadowland/qa-2026-10-22.test.ts` (55 cases, real `wave11Scenario` + `createGame`,
driven through `sessionApply`, every case that plays ends by `replay(log)` deep-equal). State surgery is marked in the
test where used.

## Findings (ranked)

| #   | Severity                                                                                                                  | Where                                                     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Source                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| F1  | should-fix, **fixed 2026-10-22** (`OWN_*` Disarm targets exclude Permanent cards; test "Oil Slick (65053) Disarm" passes) | `deadly-contraptions.ts:231-237` (Oil Slick 65053 Disarm) | "Discard an upgrade you control, then remove 4 threat": the option is offered when the only upgrade is the Permanent Creeping Corruption (every campaign hero in scenario 2), the discard does nothing (a Deadly Contraptions card is not in Black Flower, so Permanent holds), yet the 4 threat is still removed. Observed: Disarm offered, CC stays in play, threatRemoved 4. Expected: the option is not offered (no valid target) or, if chosen, no threat removed. Fix: gate on a discardable upgrade (`withoutKeyword: "permanent"`, as `heart-of-shadow.ts:216-219` does) and make the removal a `then`. | RRG 1.8 "Then" p. 44, "Target" p. 42, "Choose (Option)" p. 12; insert p. 3 Permanent |

Everything else passed. Notable correct behavior confirmed: Krahllak stage II/III keeps Retaliate across a stage change (RRG p. 47), so
the attack that defeats stage II of Krahllak in expert mode is retaliated against by stage III; the replayed trap deck reshuffle
never adds an acceleration token (insert p. 12); Whisper in the Dark (45b8c35ee) works through reveal, defeat, trap discard and the win.

Reported failure `8. ... expert campaign ... endTurn rejected: not_active_player` was a test-driver issue, fixed in the file: the
expert-campaign seat 1 had 1 hit point left from earlier scenarios, Krahllak III's Retaliate 1 (correctly) eliminated it
after the stage II defeating attack, so the turn passed to seat 2. The test now heals both seats through the real expert setup option.

## Unsettled rules questions (multiple choice, recommended first)

1. 65038 (Into the Labyrinth 1B) prints, in italics, "advance to stage 2A (the players win by advancing)". Built: advancing is not a
   win (2A reveals the chosen villain, 2B loses on completion). (a) keep, parenthetical is reminder only; (b) advancing wins and 2A/2B
   are unreachable. Recommended (a).
2. Toughness (RRG p. 45: "when a character with toughness enters play") on a villain's new stage or flipped side (SITN side B,
   Krahllak II/III): the engine places a tough status card on each. No ruling. (a) keep; (b) only when a new card enters play.
3. "After Krahllak is defeated" (Dark Invitation 1B): built per stage, so standard mode advances the scheme when stage I falls and
   expert when II falls (`heart-of-shadow.ts:206-209`). (a) keep; (b) only when the final stage is defeated. Recommended (a): the
   task brief and "1B -> 2A -> 2B" imply it, and RRG p. 47 treats each stage as a defeat.
4. Expert campaign hit points are set before the scenario's own setup damage (`campaigns/shadowland.ts` reading flag 4) against RRG
   Appendix II step 13 and insert p. 5. Recommended: keep (June 2, 2026 (3) #2 precedent).
5. Expert campaign vs expert mode: RRG p. 29 keeps them separate (built so); AoA text says "expert difficulty". Recommended: separate,
   client offers both.

## Audit card by card (text vs script vs sources)

Legend: OK = text, script and rules agree; all scripts are in `packages/cards/src/wave11/shadowland/`.

**Shadows in the Night (13)**: 1A/1B main scheme OK (`shadows-in-the-night.ts:174-190`; setup, flip A to B, reset HP, position change,
facedown card each player, win on B; expert +1 SCH/+3 HP verified in play). 2A/2B Fortress Lockdown OK (when revealed, minion
search, completion loses). 3A/3B and 4A/4B positions OK (same/different clauses, First Player Action options, FAQ p. 18 unresolvable
effect does not flip; the discard option with only a Permanent card is offered, consistent with that FAQ). 5 Black Tarantula OK. 6 Ghost
Maker OK (permanent card not discarded; verified ally chosen). 7 Sealed Entrances OK. 8 Strategic Positioning OK. 9 Surround the
Fortress OK. 10 Chaos in Hell's Kitchen x2 OK. 11 Moonlit Silhouette x2 OK.

**Dark Protege (16)**: six villains 12A-17A and B sides OK (`dark-protege.ts:191-217`; all six flip and win in play, standard and expert;
White Tiger B drops the +1 ATK as printed). 18 Art of the Kill OK. 19 Krahllak's Blessing OK (owner ruling K1). 20-23 minions OK.
24 Rite of Offering OK. 25 Shadowy Plot OK. 26 Darkness Within OK. 27 Embraced by Darkness OK. Linked lists: the record's five per villain
equal the printed keywords (tested).

**Ninja Swarm (9)**: 28 Black Mountain, 29 Kirigi, 30-34 five Ninjas, 35 Dancing Shadows, 36 Countless Numbers OK (boost excludes surge per
the announced erratum, flagged in the source).

**Shadow Labyrinth (11)**: 37 Shifting Corridors OK (passage loss immediate, verified). 38A/B and 39A/B OK (see question 1). 40 Whisper OK
(probe cases). 41 Lord Deathstrike, 42 Dead End, 43 Hall of Hidden Doors, 44 No Time to Think x2, 45 Sudden Shift x2 OK.

**Deadly Contraptions (11)**: 46 Nervous Jitters, 47 Iron Monk, 48 Hall of Punishment, 49 Path of a Thousand Cuts OK. 50 Blinding Powder,
51 Caltrops, 52 Flame Spout, 54 Poison Darts, 55 Pressure Plate, 56 Tripwire OK. **53 Oil Slick: F1.**

**Heart of Shadow (17)**: 57-59 Krahllak I-III OK (stage carry-over, Retaliate, overkill/piercing). 60A/B, 61A/B Dark Invitation OK (1B
interrupt and 2A/2B verified). 62 Dark Shroud, 63 Fear Projection, 64 Mark of the Wicked, 65 Pull of Power, 66 Fist, 67 Hellbride, 68
Retainer, 69 Snakeroot Elders, 70 Veil of Nightmares x2, 71 Submit or Suffer x2 OK by reading (covered by the pack's own tests).

**Black Flower (13)**: 72A/72B Creeping Corruption x4 OK (flip at 5 with counters removed, 72B defeat at 5, both verified through the real
Action). 73 Aka, 74 Tongue of the Beast, 75 Binding Ritual, 76 Roots x2, 77 Malediction x2, 78 Invasive Thoughts x2 OK.

## Game runs (all deterministic seeds)

- Matrix: three scenarios x standard/expert x seeds 1-3, greedy driver, plus a same-seed determinism check. Games end in a loss (the
  greedy driver cannot win); a 90-game soak over modular sets Ninja Swarm, Black Flower, Deadly Contraptions (scratch, not committed)
  threw nothing and every log replayed.
- Setup facts per scenario, standard and expert, 1 and 4 players; Black Flower as a standalone modular set.
- Six Dark Protege villains, standard and expert: random draw reaches all six; side A defeat flips, side B defeat wins.
- Trap deck: long game with 2 reshuffles (no acceleration token, only TRAP! cards in the trap discard), staged run-out, empty/empty.
- Shifting Corridors: passage loss, damage as threat removal, advance to 2A with the chosen villain (side A / B in expert).
- Krahllak standard I to II and expert II to III with Dark Invitation 1B, 2A, 2B; 1B interrupt; Creeping Corruption flip and defeat.
- Full campaigns played to real wins: standard, expert campaign, expert campaign plus expert mode; log updated at each Victory, then
  `won`; a lost scenario resets with no penalty.

Not covered here: Teamwork FAQ ordering, Krahllak interrupt order and Dark Shroud (covered by the pack's own tests only), four-player
campaigns, and any comparison against the printed scans.
