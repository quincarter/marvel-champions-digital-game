# Wave 7 QA: the owner's 2026-10-06 rulings on shipped cards

Source of the rulings: `docs/phase7-wave7.md` section 4.1, the last two tables. Tests:
`packages/cards/src/wave7/rulings-2026-10-06.qa.test.ts` (rulings 1-3) and `rulings-2026-10-06-part2.qa.test.ts` (4-8),
staging in `rulings-2026-10-06-harness.ts`. 52 tests: 51 pass, 1 `it.fails` (finding 1). Every game is driven through a
session and its command log replays to the same state. Two players wherever the rule is about other players. Cards were
chosen from Core and waves 1-7. No engine, card or client source was changed.

## Per ruling

| Ruling                                           | Real cards driven                                                                                                                                                                                                                                                                                                                            | Result                                                                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Restricted is a state limit (RRG p. 38)       | Deadpool's Katana x3; Laser Swords (counts as 2) over Katana + Bazooka; Side Holster leaving play (Caught Off Guard discards it) with 3 restricted weapons; Psylocke flipping a second Psi-Knife to the permanent restricted Psi-Katana (only the Bazooka is offered); Armed to the Teeth swapping a facedown Katana in for Panther Claws    | Pass (5). Kurt's Cutlasses is not shipped; Venom's identity limit raise not driven                                                                            |
| 2. A move of threat needs a removable source     | Temporal Leap (Cable P1, Spider-Man P2) with and without Crowd Control; Beat Cop 10029 (P2's support) locked vs open; Storm 34021; Blackout 44053 (the locked main scheme is not offered as a target); Ever Vigilant 42015 under crisis (still played, readies, removes nothing)                                                             | Pass (8). Storm has no case that differs: a crisis icon protects the main scheme as a source only, and she cannot thwart it                                   |
| 3a. "Would" attacks                              | Webbed Up on Rhino with Charge (Charge never gathered, Spider-Sense not offered); Webbed Up on Whirlwind (P2 takes nothing); Hope's Captor + Marauder, 2 players (P1: schemes, no Charge window; P2: attacked, Charge resolves); Hobgoblin + Webbed Up                                                                                       | Pass (5). Two would abilities on one attack are still ordered by the first player (as built)                                                                  |
| 3b. "Would" defeats                              | Loki 06028 + Spider-Tracer; Deadpool's identity + Git Gud, both orders; Captain America's Helmet with Git Gud on P2 (forced first, the optional Helmet is never offered, RRG p. 17)                                                                                                                                                          | Pass (4) + finding 1                                                                                                                                          |
| 4. 0 damage opens no window                      | Warning in P2's hand and Backflip in P1's hand on fully defended attacks (not offered; offered when undefended); Cap's Shield retaliate after a 0-damage attack; Radioactive Man's "after attacks you" after a 0-damage attack; Cypher vs tough                                                                                              | Pass (4 + 1 in section 6)                                                                                                                                     |
| 5. Defender without DEF; defense between players | Angel's Aerial Agility with no basic defense (2 damage, DEF not applied); control with a basic defense; label then basic defense is one defender and Electrostatic Armor fires once; P1's Aerial Agility on the attack against P2 locks out P2's Backflip; P1 stepping in as defender does the same                                          | Pass (6). Not driven: Shield Block, Quick Shift, Mutant Protectors, an ally defending while its owner plays a defense card, Desperate Defense and Unflappable |
| 6. Cypher, Warpath, Float                        | Cypher kills a confused minion and draws; with Float Like a Butterfly (+1) the kill needs it; not confused and tough: no draw; Warpath defends and plays Ever Vigilant or For Justice! in the villain phase                                                                                                                                  | Pass (5)                                                                                                                                                      |
| 7. The "you" reader                              | I See You 02030 (Mutagen Formula, per attacked player: 2 icons with a Goblin Thrall engaged, 1 without, whichever player holds the other thrall); Sowing Discord to P1 and Manufactured Drama to P2 (each blocks only its own player's allies or supports); Psionic Amnesia (+2 only for the attached identity's player); Mind Trap; Seduced | Pass (5)                                                                                                                                                      |
| 8. Hidden in the Clutter; trait split            | Tough spent before the card is touched; 2 held + 2 dealt makes the minion attack the player who dealt it, then the card is discarded; a stun keeps it attached; Mission Leader costs 1 for Carol, 2 for Peter; Field Agent protects Agent 13 (27046)                                                                                         | Pass (6) + finding 3                                                                                                                                          |

## Findings

1. **Loki 06028 is never healed (`it.fails`).** His replacement tests the discarded card with `refMatches(...)` and no `anywhere`,
   so a card in the encounter discard pile never matches. With a treachery on top he is defeated anyway (and Spider-Tracer still
   fires, 5 threat to 2). `wave1/thor/nemesis.test.ts` "survives, healed" passes vacuously: a defeated minion's damage is also 0.
   Not caused by today's commits (a7f8dcbf only added `would`). Owner: `ability-scripting-engineer` (Thor nemesis set).
2. **Open question: "after ... deals damage" after tough versus after a prevention interrupt.** She-Hulk (ATK 3) hits Rhino carrying
   Power Stone 16149 ("after a hero deals 3 or more damage to attached character"): with a tough status the damage is prevented and
   Power Stone still moves to her; with Telekinetic Force Field 40034 (prevents all damage) it does not. RRG "Prevent" (p. 35) says
   prevented damage is still dealt, only "taken" and "attacked and damaged" are not met, and "Tough" (p. 44) prevents too. Pinned both
   ways in section 4b. Cards affected by a search: Power Stone 16149 and Challenge Accepted 19028 (the `dealDamage` responses); the
   prevention sources are Force Field 40034, Photographic Reflexes 04104, Temporal Shield 11014, Abjuration 21082, Biogram Image 16074.
   A scan of every `dealDamage` response was not done.
   - A. Both fire for "deals / is dealt" wording, neither for "takes" or "attacks and damages" (RRG p. 35; matches the ruling's own wording). **Recommended.**
   - B. Neither fires (extend "0 damage opens no window" to dealt).
   - C. Leave it: tough counts as dealt, a prevention interrupt does not.
3. **Hidden in the Clutter loops against retaliate (card interaction, as printed).** "Then, discard this card" comes after the attack,
   so Black Panther's retaliate 1 damages the attached minion during it; the damage lands on the card again and the minion attacks
   again, until the defender is out of hit points. Pinned in part 2. Likely the same in paper; owner to confirm.
   Overruled on 2026-10-07 (see the update below).

## Collateral sweep

`pnpm --filter @mc/engine test`: 454 files, 4066 passed, 11 todo, none red. The full cards suite was not run (another QA agent was
mid-run). Instead the folders the day's commits touched: `would-be-defeated-tier`, `wave1/{gob,drs,thor}`, `wave7/{angel,psylocke,
deadpool}`, `wave7/next_evol/cable`, `telepathy`: 48 files, 1931 passed, none red. `pnpm lint` is red only in
`packages/client/e2e/wave7-screens.spec.ts` (four unused names, not mine). `tsc` errors are only in the other agent's
`qa-*.scratch.test.ts` (no `node` types).

## Coverage still thin

Spiral, Teleported Away, Phased and Confused and the Norman Osborn / Green Goblin would-markers; Too Stubborn to Die, "I Got Better",
Rise from the Ashes and the Hela / Escape the Museum / Odin's Torment / Horror defeat replacements; the "you" reader on Delusion of Collusion and Stryfe's own attachments.

**Update (same day):** finding 1 is fixed. Loki 06028 reads the discarded card wherever it is and is healed on a treachery; his test no longer passes when he is defeated. Left as built and unchecked against the RRG: with an empty encounter deck the discard pile is reshuffled in, no card is discarded and Loki is defeated.

**Update 2026-10-07: findings 2 and 3 are resolved by the owner's rulings (`docs/phase7-wave7.md` section 4.1).**

- **Finding 2, resolved (option A).** "After X deals / is dealt damage" fires after a tough status card and after a
  prevention alike; "after X takes damage" and "attacks and damages" fire after neither. A damage event now carries the
  amount dealt and the amount taken (RRG "Prevent", p. 35), and each response reads one of them. Section 4b drives it:
  with tough and with Telekinetic Force Field 40034 Power Stone 16149 moves to She-Hulk, and Vibranium Armor 01152
  ("after the villain takes damage") does not answer in either. The scan the finding lacked is
  `docs/dealt-vs-taken-audit.md`: 3 responses read damage dealt (Power Stone, Challenge Accepted 19028, Schadenfreude
  16032; all three changed), 19 read damage taken (unchanged), and 64 interrupts read the pending amount (unchanged).
- **Finding 3, resolved: one attack only.** Hidden in the Clutter 40106 does not trigger again while its own Forced
  Interrupt is still resolving (the attack it started, then its discard). The defender's retaliate damage is therefore
  not redirected: it is dealt to the attached enemy itself, and the card is discarded once the attack ends. Section 8a:
  against Black Panther the Hydra Mercenary attacks once, Black Panther takes 1, the minion takes 1 and the card is in
  the discard pile. A stun still replaces the attack and leaves the card attached.
