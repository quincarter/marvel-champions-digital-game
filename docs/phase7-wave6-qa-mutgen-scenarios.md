# Phase 7 wave 6 rules-QA pass: Mutant Genesis scenarios (`mut_gen`)

`rules-qa-engineer`, 2026-10-03. Scope: the box's five scenarios (Sabretooth, Project Wideawake, Master Mold, Mansion
Attack, Magneto) and their modular sets (Brotherhood, Acolytes, Mystique, Sentinels, Zero Tolerance, Future Past) against
RRG 1.8 (FAQ pp. 62 to 64, errata pp. 67 to 68), the MC32 rulebook and the post-1.7 rulings. Not the heroes (Colossus,
Shadowcat) or the campaign: later passes. Test file: `packages/cards/src/wave6/mut_gen/qa.test.ts`; no non-test code
was touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` and `marvel-champions-rulings-post-rrg-1-7.md` for every card title in
`packages/content/src/data/mut_gen/cards.ts` (198 titles), the six villains and sets by name, and Mutant Genesis. Page
numbers are printed pages (the page number printed under an entry's text).

| Source                                                                                                                                                                 | Card                                                                                   | Where it is pinned                                                                                                                                                                                                                                                      | Result                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| FAQ "Operation Zero Tolerance (#104)", p. 63: an ally not discarded after being defeated (returned to hand, shuffled into the deck) still goes under it                | Operation Zero Tolerance                                                               | Already: `project-wideawake.test.ts` "FAQ Operation Zero Tolerance (#104), RRG 1.8 p. 63" (Regroup returns it to hand). The shuffled-into-the-deck case uses the same selector and is not staged separately                                                             | Pass                        |
| Ruling Jan 26, 2026 (4) #5: a Drone minion that defeats an ally puts it under Operation Zero Tolerance; the facedown side does not matter                              | Operation Zero Tolerance                                                               | Already: `project-wideawake.test.ts` "ruling Jan 26, 2026 (4) #5"                                                                                                                                                                                                       | Pass                        |
| FAQ "Fabian Cortez (#159)", p. 64: he is discarded as the found Acolyte enters, so its teamwork does not see him                                                       | Fabian Cortez                                                                          | Already: `acolytes.test.ts` "FAQ #159 (p. 64)"                                                                                                                                                                                                                          | Pass                        |
| Erratum p. 68, Mutants at the Mall (#88A): "discarding any other ally version of Jubilee from play"                                                                    | Mutants at the Mall, Jubilee                                                           | Already: `project-wideawake.test.ts` "any other ally version of Jubilee is discarded from play". New, `qa.test.ts`: the same card's "searches the encounter deck and discard pile" with the Sentinel minion only in the discard pile                                    | Pass                        |
| Ruling Jun 2, 2026 (1): Jubilee's lasting effect targets the chosen enemy; Cameo / ally versions work the same                                                         | Jubilee (32088b)                                                                       | Already: `wolv/qa.test.ts` seats this box's ally Jubilee as the "other version"                                                                                                                                                                                         | Pass                        |
| Erratum p. 68, Asteroid M (#141B), Factory Online (#142B), The Rule of Magnus (#143B): magnet counters are removed before the Magnetic card is revealed                | The three Magneto main scheme B sides                                                  | Removal and reveal already: `magneto.test.ts` (stage 1 in detail, stages 2 and 3 in one test, Q8). New: the ORDER on all three stages. Electric Shock (Magnetic, hero form) reads the counters when revealed: it takes 0 damage, `counterRemoved` precedes the reveal   | Pass (3 tests)              |
| Ruling Jan 26, 2026 (3) (Nimrod 4 HP left, Into the Fray deals 6, takes 3: 2 excess dealt), superseded by RRG 1.8 "Overkill" p. 31 (excess dealt = the overkill value) | Nimrod (32166, Future Past), Into the Fray                                             | Engine level already: `engine/src/excess-equals-overkill.test.ts` (the example's Nimrod as a stub), `max-sustained-damage.test.ts`. New: the real Nimrod and the real Into the Fray (13013): he takes 3, 0 excess, 0 threat removed, per the RRG                        | Pass                        |
| Ruling Feb 28, 2026 (6): a villainous minion's boost card that gives "the villain" a boost card gives it none, "because the villain is not activating"                 | Ground Swell (32132) and the three other Brotherhood treacheries, Bastion (villainous) | New: Avalanche is the villain, Bastion activates with Ground Swell as his boost card. Villain: 1 boost card (correct). Bastion: 2 (wrong)                                                                                                                               | **Fail, pinned `it.fails`** |
| MC32 rulebook pp. 7 to 18, standalone setup (villain stages by difficulty, sets, Setup text, Multiple Villains 1/2/3/4)                                                | All five scenarios                                                                     | Already, scenario by scenario: `sabretooth.test.ts`, `project-wideawake.test.ts`, `master-mold.test.ts` ("expert mode starts on Master Mold (II)"), `mansion-attack.test.ts` ("heroic mode needs all four villains, skirmish one"), `magneto.test.ts` ("Asteroid M 1A") | Pass                        |
| FAQ "White Queen (#56)", "Mutant Protectors (#17)", "Powerful Punch (#14)" (p. 63), Armor Up (#10), Steel Fist (#8) (p. 68)                                            | Shadowcat's and Colossus's cards                                                       | Heroes: the next pass                                                                                                                                                                                                                                                   | n/a                         |
| Erratum p. 68 Mystique's Manipulations (#26); Magnetic Missile (#10); Mutants at the Mall has Jubilee only as an ally                                                  | Rogue's / Magneto's hero pack cards                                                    | Not this box's scenario cards (the Mystique modular set does not contain Mystique's Manipulations)                                                                                                                                                                      | n/a                         |

Teamwork (trait), RRG 1.8 p. 43 ("resolves after any When Revealed abilities"), Villainous (a villainous minion is dealt a
boost card, RRG p. 9) and Master Mold's "do not give Master Mold a boost card" (the `boostWithheld` event) have module
tests already (`acolytes.test.ts`, `master-mold.test.ts`); the games below also see `boostWithheld`.

No other erratum on pp. 65 to 69, FAQ entry on pp. 55 to 64 or post-1.7 ruling names a card of these scenarios or sets.
Hall of Heroes' taboo list is unofficial and was not used.

## 2. Whole games (new)

Seeds are the first match of a deterministic search over 1..60, so a given run always finds the same game. Every game is
played from setup by the greedy driver, replayed with `replay(log)` and the final state compared with `toEqual`.
Heroes are wave 6 precons (`cyclops-leadership`, `phoenix-justice`, `wolverine-aggression`, `storm-leadership`).

| Game                                | Variants (heroes)                                                                                                                                                                                            | What the game must contain                                                                                                                                                                          | Staged? |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Sabretooth (Brotherhood + Mystique) | 2 players standard (Cyclops, Phoenix)                                                                                                                                                                        | Stalked by Sabretooth hits Robert Kelly (damage on Kelly), Find the Senator defeated, flipped to Protect the Senator (`cardFlippedToOtherFace`), the first player takes Kelly (`controllerChanged`) | No      |
| Sabretooth                          | 1 hero expert (Wolverine)                                                                                                                                                                                    | The same, by a staged first turn                                                                                                                                                                    | Yes     |
| Project Wideawake (Sentinels)       | 2 players standard (Wolverine, Storm); 1 hero expert (Phoenix)                                                                                                                                               | The four Captive allies set aside at setup; Operation Zero Tolerance's response (and Night of the Sentinels' response in the 2-player game)                                                         | No      |
| Project Wideawake                   | the same two variants                                                                                                                                                                                        | Abduction Protocols defeated (staged thwart), one Captive ally in play under P1                                                                                                                     | Yes     |
| Master Mold (Zero Tolerance)        | 2 players standard (Storm, Cyclops); 1 hero expert (Wolverine)                                                                                                                                               | A Master Mold Forced Interrupt (32109 to 32111) resolved and a `boostWithheld` of `activation: "scheme"` (Sentinel production, noBoost)                                                             | No      |
| Mansion Attack (Mystique)           | 2 players standard (Phoenix, Wolverine); 1 hero expert (Cyclops)                                                                                                                                             | 3 villains set aside at setup, stage order a permutation of 0..4 starting at 0, a `mainSchemeCompleted` and a `mainSchemeAdvanced` (the shuffled stages are walked)                                 | No      |
| Magneto (Acolytes)                  | 2 players standard (Storm, Phoenix); 1 hero expert (Cyclops)                                                                                                                                                 | The Asteroid M response resolved, a `counterRemoved` of 3 magnet counters, and Wrapped in Metal (32150) revealed                                                                                    | No      |
| One game per modular set            | Brotherhood on Sabretooth (2p); Acolytes on Magneto (2p); Mystique on Mansion Attack (expert solo); Sentinels on Wideawake (2p); Zero Tolerance on Master Mold (expert solo); Future Past on Sabretooth (2p) | A card of the set resolves an ability (`3207[3-9]`, `3216[0-5]`, `3208[0-3]`, `3210[5-8]`, `3210[1-4]`, `3216[6-9]`/`32170`)                                                                        | No      |

Staging, said plainly: in 60 seeds the greedy driver never defeated Find the Senator in the solo expert Sabretooth game
(it did in the 2-player game, unaided), and never defeated Abduction Protocols in either Wideawake variant (each seed takes
3 to 5 s, a 60-seed search about 3 minutes). Those games are staged by surgery: Abduction Protocols / Find the Senator is
set to 1 threat, then P1 changes to hero form and thwarts it through `sessionApply` (so the prefix log replays), then the
driver plays to an outcome. Two logs, each replayed deep-equal: the prefix equals the state handed to `playToOutcome`, and
that run's log equals its final state. The signature is asserted on the prefix's events and state. Nothing in the other
games is staged. No game wins (the greedy driver ends in a loss, as in the other passes); an outcome is only required
to exist. The older `*-e2e.test.ts` files already play each scenario with a Core hero.

## 3. Findings

### Bug: a boost card that gives "the villain" an extra boost card gives it to the activating minion (pinned)

- **Expected** (Ruling Feb 28, 2026 (6), Alex Werner: a villainous minion draws Pirate Lackey, which gives the villain a
  boost card; "No. Because the villain is not activating, do not give it a boost card."): the Brotherhood treacheries'
  "[star] Boost: If the villain is Avalanche, give him an additional boost card for this activation" does nothing
  when a minion, not the villain, is activating. Only the villain and villainous minions are dealt boost cards (RRG "Attack (Enemy Activation)" p. 9, "Boost" p. 11).
- **Actual:** the extra card goes to the minion whose activation is in progress.
- **Repro** (`qa.test.ts`, `it.fails` "Avalanche is the villain, Bastion (villainous) activates with Ground Swell as his boost
  card"): `mansionAttackGame({ villain: "Avalanche", modularSetIds: ["future_past"] })`, hero form, Bastion (32167, villainous)
  engaged by surgery, encounter deck stacked `01186`, `32132` (Ground Swell), `32136`; P1 ends the turn. `boostCardDealt`:
  villain 1 (correct), Bastion 2 (should be 1).
- **Cause:** `extraBoostIfVillain` in `mansion-attack.ts` is `boost(ifThen(exists(villain named X), modifyAttack({ extraBoostCards: 1 })))`;
  `modifyAttack` applies to the activation in progress whoever is activating.
- **Caveat on the authority:** the ruling names Pirate Lackey and a villainous minion, not these cards; the application is by
  analogy (same wording shape: "give the villain an additional boost card" while the villain is not the one activating).
  Whether the extra card should go to the minion instead (the card says "for this activation") is not answered by the ruling;
  it is a rules question for the owner if the analogy is not accepted. The four cards are Mansion Attack's, so the case is
  reachable in a real game (Fabian Cortez and Bastion are the villainous minions of the sets).
- **Owner:** `ability-scripting-engineer` (the four `*.boost` scripts) with `game-rules-architect` if `modifyAttack` should
  refuse an extra card for an activation whose enemy is not the named one.

### Known, not re-reported

- Robert Kelly attached to a scheme is in no play area, so lethal damage never defeats him (pinned `it.fails` in
  `sabretooth.test.ts`, the handoff's engine note). The staged and unaided Sabretooth games here do not depend on it.
- Find the Senator's crisis icon blocks main-scheme thwarts by design (handoff).
- The "take damage" cost bug (RRG p. 14) was handled in the MojoMania pass.

### Flagged conflict, resolved by the RRG

Ruling Jan 26, 2026 (3) and RRG 1.8 "Overkill" (p. 31) disagree about excess damage "dealt" when damage is capped or
reduced; the RRG's later revision wins (user decision 2026-09-25, `engine/src/excess-equals-overkill.test.ts`). The new Nimrod
test pins the RRG reading with the real cards.

### Not checked (thin coverage, said plainly)

- A card-by-card audit of the five scenario sets against their scans: the module tests cover each card; this pass read only
  the cards that rulings, errata, the rulebook and interactions name.
- Mansion Attack's four villains in sequence (Save the School's win and advance, victory by difficulty) are covered by
  `mansion-attack.test.ts`; the greedy driver never defeats a villain, so no whole game plays a second villain.
- Magneto's later stages (defeating a stage by the driver) and Boarding Party / Sabotage Master Mold being defeated happen in
  the games only incidentally; their text is in `magneto.test.ts`.
- FFG's Feb 28 (6) analogy (see above); Fabian Cortez's ruling is the only Acolytes ruling, the other Acolytes minions have none.
- Future Past in its campaign deck form (a separate scenario deck) is a later campaign pass; here it plays as a modular set.

## 4. Test record

- `cd packages/cards && pnpm exec vitest run src/wave6/mut_gen/qa.test.ts`: 23 passed, 1 expected fail (the pinned bug), 24 tests,
  about 90 s.
- `pnpm exec oxlint` and `pnpm exec oxfmt --check` on the test file and `pnpm --filter @mc/cards exec tsc -p tsconfig.json
--noEmit` for the file: clean.
