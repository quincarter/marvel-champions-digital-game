# Phase 7 wave 6 rules-QA pass: the MojoMania scenario pack (`mojo`)

`rules-qa-engineer`, 2026-10-03. Scope: MaGog, Spiral and Mojo (villains, main schemes, own sets), the six genre sets
and Longshot, against RRG 1.8, the FAQ (p. 64) and errata (p. 69), and the post-1.7 rulings. Tests: one new file,
`packages/cards/src/wave6/mojo/qa.test.ts`; no non-test code was touched. Fixture list: `docs/phase7-wave6.md` §7.6;
games: §7.8's rules-qa bullet.

## 1. The §7.6 fixtures

Each fixture was already pinned exactly by a module test, so `qa.test.ts` does not copy them (it lists them in its
header). The check was to read each pinned test against its source and confirm it asserts what the source says.

| Fixture                                                                                                             | Source                                          | Pinned in                                                                                                                                      | Result                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Spiral flips with Dial M in play; her incite 1 places 1 threat                                                      | FAQ "Dial M for Mojo (#35)", RRG p. 64          | `wave6/mojo/spiral.test.ts` (two tests, with a Mojo Runner control)                                                                            | Pass                                                    |
| Overkill attack on a minion: +1 to the minion's damage, +1 to the spill                                             | FAQ "Wild Wild Mojo (#66)", p. 64; insert p. 18 | `wave6/mojo/western.test.ts` (minion case, and the ally case from the villain's attack)                                                        | Pass                                                    |
| Wild Wild Mojo adds 1 to an ally's consequential damage only when it takes at least 1                               | Insert p. 18, bullet 1                          | `western.test.ts` "an ally's consequential damage is +1 only when it takes at least 1"                                                         | Pass                                                    |
| Stinger Tail discarded by an attack's damage is gone before its retaliate 2                                         | Insert p. 18, bullet 2                          | `wave6/mojo/mojo.test.ts`                                                                                                                      | Pass                                                    |
| Stinger Tail and Undercover Mojo both in play: first player picks, the other has nothing                            | Insert p. 18, bullet 3                          | `mojo.test.ts` (`orderTriggers`)                                                                                                               | Pass                                                    |
| A SHOW from the show deck or the Wheel does not surge                                                               | Insert p. 18                                    | `spiral.test.ts` (Search's reveal), `mojo.test.ts` (Wheel; 1B), and the horror, fantasy, western and sitcom sets' "revealed by a search" tests | Pass                                                    |
| With Spiral ESCAPED or Dragnet in play, a damage-only effect cannot target the villain; one with another effect can | Ruling Apr 30, 2026 (1)                         | `spiral.test.ts`, `crime.test.ts` (Nick Fury's "deal 4 damage" against Heroic Strike's stun)                                                   | Pass                                                    |
| Longshot revealed at campaign setup resolves his When Revealed                                                      | Ruling Apr 30, 2026 (3) #1 (Q42)                | `campaigns/mojo.test.ts` "Longshot in play at the end of scenario 1 ..."                                                                       | Pass                                                    |
| Fetch Quest cannot play a card with a requirement                                                                   | Errata p. 69                                    | `wave6/mojo/fantasy.test.ts` (Nova's No Quarter never offered)                                                                                 | Pass                                                    |
| The Search for Spiral: "Take 2 damage → remove 3 threat"                                                            | Errata p. 69                                    | `spiral.test.ts` (cost is `damageSelf: 2`, damage before removal); prevented damage: see section 3                                             | Definition passes; **the rule behind it fails (BUG 1)** |

## 2. Whole games (new, `qa.test.ts`)

The one-hero standard games were already in `magog-e2e`, `spiral-e2e` and `mojo-e2e`. This pass added each §7.8 game
in 2 players (standard) and in expert (one hero), 2 variants each, all replayed deep-equal (`replay(log)` reaches a final
state `toEqual` the live one). Seeds are the first match of a deterministic search over a fixed range, so a given run
always finds the same game. The greedy driver never wins unaided, which is why some games are staged.

| Game                                 | Variants                                                          | Staged by surgery?                                                             | Why                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MaGog won on The Challengers         | 2p (flip at 10, win at 20 ratings), expert (flip at 5, win at 10) | Yes: The Challengers start with 16 (2p) or 6 (expert) ratings counters         | The driver puts about 10 counters on the Challengers in a two-player game before the heroes fall, and a win takes 20. The flip, the rest of the placements, Tag Team and the win are played.                                                               |
| MaGog lost on The Champion           | 2p, expert                                                        | No                                                                             | Played from setup; the first seed whose loss has 10 per hero ratings counters on The Champion.                                                                                                                                                             |
| Spiral through the show deck         | 2p, expert                                                        | No                                                                             | Played from setup. Required: Cornered! revealed, then shuffled back into the show deck (a move into it after the reveal), and a SHOW sent from play to the bottom of the show deck (a move from play, not the setup build). Show deck discard stays empty. |
| Mojo resets the encounter deck twice | 2p (8-card deck), expert (6-card deck)                            | Yes: the encounter deck is cut to 6 or 8 cards, the rest removed from the game | A real 40-card deck seldom resets once before the greedy driver loses. Required: at least 2 `accelerationTokenAdded` resets, a Wheel `cardFlipped`, a set shuffled on top after the first reset. The resets themselves are the engine's.                   |
| Mojo lost when no set remains        | 2p, expert                                                        | Yes: no set left set aside, deck cut to 3                                      | The loss is the Wheel's reset with nothing to bring in: the Wheel never flips, Mojo is not defeated, the loss is not the main scheme.                                                                                                                      |

Pass: all eight game checks.

Note on the older `spiral-e2e.test.ts`: its "SHOW went to the bottom" predicate (`cardMoved` into the scenario deck for a
SHOW id) is also true of setup's own build of the show deck, so it does not prove a SHOW was sent to the bottom in play.
The Spiral games in `qa.test.ts` use the stricter check above. Not a bug in the engine; a weak assertion, left as is.

## 3. Findings

### BUG 1 (engine, fixed in 3d004785): "take damage" as a cost is paid even when tough prevents all of it

- **Source:** RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that
  damage was taken. (If any of the damage is prevented, then the cost has not been paid.)" FAQ "Focused Rage (#27)"
  (p. 57): with a tough status card She-Hulk "cannot use Focused Rage", because tough prevents the damage and "you cannot
  partially pay a cost". Errata p. 69 makes The Search for Spiral's 2 damage a cost.
- **Expected:** The Search for Spiral's Hero Action with the hero holding a tough status card: the cost is not paid,
  no threat is removed.
- **Actual:** threat on the scheme goes 5 to 2; the ability resolves.
- **Repro:** `qa.test.ts` "a tough status card on the hero prevents the damage ...", pinned `it.fails`. Spiral game
  (1 hero, Spider-Man), hero form, `patchInstance` the hero's `statuses.tough = 1` and the scheme's `threat = 5`, then
  `use(P1, search, "39016.the-search-for-spiral-action")`.
- **Cause (read, not fixed):** `AbilityCost.damageSelf` in `packages/engine/src/actions.ts` (~2268) pushes a bare
  `dealDamage` and never settles it. `indirectDamage` and `damageCards` push `settleCostDamage`
  (`packages/engine/src/cost-damage.ts`), which marks the frame `cost.notPaid` so the effects do not resolve. The doc
  comment on `damageCards` (abilities.ts ~1690) even lists `damageSelf` among the costs that behave this way.
- **Reach:** every `takeDamageCost` card: She-Hulk's Focused Rage (01027, the FAQ's own example), Wolverine's Claws,
  Tower Defense, Ronan, Obedience Potion, Venom's kit, Gamora's nemesis, plus Spiral's Search. Not specific to `mojo`.
- **Owner:** `game-rules-architect` (engine cost payment). **Fixed in 3d004785:** `damageSelf` now pushes
  `selfCostDamageEffects` (damage, then `settleCostDamage`), and `planCost` refuses it when the identity could not take
  all of it (tough, cannot take damage, a constant prevention or reduction), as for `damageCards`. The pin is now a
  plain `it` (not offered, refused, tough stays); `packages/engine/src/damage-self-cost.test.ts` and
  `packages/cards/src/core/heroes/she-hulk-focused-rage.test.ts` cover the rest.

### Other

- No card-script discrepancies found in the fixtures above.
- Not checked in this pass (thin coverage, said plainly): a full card-by-card audit of the genre sets and Mojo's cards
  against their scans (module tests cover them, this pass read only the fixture-bearing ones); the pending defaults
  Q51 to Q79 were built as recorded in `docs/phase7-wave6-handoff.md` and not re-opened; Longshot's campaign carry-over
  beyond ruling Apr 30, 2026 (3) #1; the `campaigns/mojo.qa.test.ts` file is another pass's and was not re-read.

## 4. Test record

- `cd packages/cards && pnpm exec vitest run src/wave6/mojo/qa.test.ts`: 11 passed, 1 expected fail (BUG 1), about
  30 s.
