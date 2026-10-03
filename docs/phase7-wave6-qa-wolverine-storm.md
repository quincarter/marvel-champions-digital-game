# Phase 7 wave 6 rules-QA pass: Wolverine and Storm (`wolv`, `storm`)

`rules-qa-engineer`, 2026-10-03. Scope: the two hero packs (Wolverine / Logan 35001 with his kit, the Omega Red
nemesis set and the Lady Deathstrike modular set; Storm / Ororo Munroe 36001 with her Weather deck, the Callisto nemesis
set and The Shadow King modular set) against RRG 1.8 (FAQ p. 55 to 64, errata p. 65 to 69) and the post-1.7 rulings.
Tests: `packages/cards/src/wave6/wolv/qa.test.ts` and `packages/cards/src/wave6/storm/qa.test.ts`; no non-test code was
touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` and `marvel-champions-rulings-post-rrg-1-7.md` for Wolverine, Logan,
Storm, Ororo, Aggressive Energy, Berserker (Barrage, Frenzy), Jubilee, Omega Red, Deathstrike, Flash Freeze, Weather,
Claustrophobia, Possessed, Shadow King, Gambit, Pixie, Magik, Adamantium and every card title of both packs.

### Wolverine pack

| Source                                                                                                                                                                  | Card                                            | Where it is pinned                                                                                                                                                                                   | Result |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Erratum RRG p. 68, Logan (#1A): "Setup: Put Wolverine's Claws into play."                                                                                               | Logan, Wolverine's Claws                        | Already: `wolv/wolverine/identity.test.ts` "35001b.logan-constant (Snikt! Setup)" (3 tests)                                                                                                          | Pass   |
| Erratum RRG p. 68, Berserker Barrage (#8): "you may take 2 damage to repeat this ability"                                                                               | Berserker Barrage                               | Already: `wolverine/events.test.ts` "Berserker Barrage (35008)" (decline, accept with a fresh target, repeat that defeats nothing). New: the repeat is not offered when Omega Red survives (below)   | Pass   |
| Ruling Jul 9, 2026 (3) #4: Aggressive Energy increases damage dealt to enemies, not to Wolverine                                                                        | Berserker Barrage, Aggressive Energy            | Already: `events.test.ts` "with Aggressive Energy (35020)", and through `sessionApply` in `wolverine/e2e.test.ts`                                                                                    | Pass   |
| Ruling Jun 2, 2026 (1): Jubilee's lasting effect targets the chosen enemy, not card instances; stacks per trigger; Cameo / ally versions work the same                  | Jubilee                                         | Stacking already: `support-upgrades-allies.test.ts` "each trigger stacks". New, `wolv/qa.test.ts`: after a flip of form, another card titled Jubilee, and the ally Wolverine (32041)                 | Pass   |
| FAQ "Dance of Death (#4)", p. 59: each damage-dealing effect is its own attack, a stun cancels only the first                                                           | Slice and Dice (same shape; scripted citing it) | Two attacks already pinned in `events.test.ts`; the stun is new, `qa.test.ts` (3 damage, not 6; control 6)                                                                                           | Pass   |
| RRG "Permanent" (p. 32): a permanent card is not a valid target of an effect from another set that would remove it; the effect targets the non-permanent card that fits | Wolverine's Claws, Caught Off Guard (01188)     | New: the Claws is the only upgrade, so nothing is discarded and the card surges; with Adamantium Skeleton also attached it is discarded instead and there is no surge                                | Pass   |
| FAQ "Unflappable", p. 60: damage from another ability during an attack is not damage from the enemy's attack (it concerns a Boost ability)                              | Omega Red's interrupt, Berserker Frenzy         | New: an ally defends, Wolverine took 1 from Omega Red's Forced Interrupt and 0 from the attack, so Frenzy is not offered; undefended control offers it. By analogy, not the same card: see section 4 | Pass   |
| Q20 (decided, not an FFG ruling): Death Factor replaces only the healing of a basic recovery                                                                            | Death Factor, Healing Factor                    | New: Healing Factor's 2 heal still lands with Death Factor attached and its interrupt is never offered (5 + 1 - 2 = 4)                                                                               | Pass   |
| Card text: Berserker Barrage "if this attack defeats an enemy"                                                                                                          | Berserker Barrage, The Carbonadium Synthesizer  | New: Omega Red at lethal damage with the side scheme in play survives and no repeat is offered; control without it is defeated and offered                                                           | Pass   |
| Card text: Berserker Frenzy "damage from an enemy attack"                                                                                                               | Hack 'n' Slash                                  | New: Hack 'n' Slash revealed in hero form deals damage that is not an attack's; Frenzy not offered                                                                                                   | Pass   |
| Ruling Jul 9, 2026 (3) #1 (alter-ego Setup always resolves after a setup form change)                                                                                   | Logan's Setup                                   | Names Stryfe II; no scenario in the pool changes form during setup, so no test                                                                                                                       | n/a    |
| Ruling Jul 9, 2026 (3) #5 (Peril prohibits other players from acting)                                                                                                   | none of this pack                               | Fiery Rage is Phoenix's (pinned in the Cyclops and Phoenix pass)                                                                                                                                     | n/a    |

### Storm pack

| Source                                                                                                                   | Card                                           | Where it is pinned                                                                                                                                                                                                                                                                  | Result |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Erratum RRG p. 68, Claustrophobia (#30): "You cannot change to hero form"                                                | Claustrophobia                                 | Already: `storm/storm/obligation-nemesis.test.ts` (blocks the change to hero form, not out of it, lifts when removed)                                                                                                                                                               | Pass   |
| Erratum RRG p. 68, Possessed (#38): "Attached ally engages its controller. If you cannot, this card gains surge"         | Possessed                                      | Already: `storm/shadow-king/index.test.ts` "Possessed (36038)" (lowest THW, engaged, second copy, no ally means surge)                                                                                                                                                              | Pass   |
| Ruling Dec 17, 2025 (3): Flash Freeze triggers "when" the villain attacks, so it is playable only when Storm is attacked | Flash Freeze                                   | Positive half already: `storm/events.test.ts` "is offered when the villain attacks Storm". New, `storm/qa.test.ts`: not offered for the villain's attack on a second hero, nor for an engaged minion's attack on Storm (offers counted over the activation step: 1 each, control 1) | Pass   |
| Ruling Aug 3, 2026 (4) #1: Odin attached to the main scheme is not a valid target for Possessed                          | Possessed                                      | New: Odin (21139a) seated attached to the main scheme beside Mirage (THW 2, tied): Possessed goes to Mirage, Odin keeps no attachment and is never offered                                                                                                                          | Pass   |
| Ruling Mar 19, 2026 (2): a target that cannot take damage is not valid for a basic power                                 | The Shadow King                                | Already: `shadow-king/index.test.ts` "36036.the-shadow-king-constant" (basic attack refused, lands once the Controlled minion is gone)                                                                                                                                              | Pass   |
| RRG "Target" (p. 43): a target that cannot take damage is not valid for an effect whose only effect on it is damage      | Lightning Bolt, Blast of Wind, The Shadow King | New: Lightning Bolt's choice offers the villain and the possessed minion but not the king; Blast of Wind deals him nothing while the villain and an engaged minion take 3                                                                                                           | Pass   |
| RRG "Permanent" (p. 32)                                                                                                  | Weather supports, Caught Off Guard             | New: the Weather support is the only support, so it stays and the card surges; with Ororo's Garden also in play that is discarded instead, no surge                                                                                                                                 | Pass   |
| RRG "'Swap'" (p. 42): a swap cannot be completed if there is not a component in both locations                           | Weather Control                                | New: no Weather support in play (surgery: back into the deck), Weather Control swaps nothing: nothing enters play, the deck keeps 4, no `cardsSwapped`                                                                                                                              | Pass   |
| RRG "'Swap'" (p. 42), different titles: the new card enters ready, the old leaves, the deck is shuffled                  | Weather Control, Weather Goddess               | Already: `storm/identity.test.ts` "swaps the support in play for the chosen one ..."; `events.test.ts` "Weather Goddess (36009)"                                                                                                                                                    | Pass   |
| FAQ "Magik", p. 64: a card Magik plays from the top of her deck is played from her hand (Pixie, Storm #17)               | Pixie                                          | No Magik hero is scripted in this repo yet, so it cannot be tested; Pixie's response is on `on.youPlayThis()` (any play of Pixie), which satisfies it                                                                                                                               | n/a    |
| Ruling Apr 30, 2026 (4) #2: Overseer / Prelate Shadow King in the Apocalypse scenario                                    | Shadow King (campaign)                         | Age of Apocalypse campaign content, outside wave 6                                                                                                                                                                                                                                  | n/a    |

No other erratum on p. 65 to 69, FAQ entry or post-1.7 ruling names a card of either pack (Gambit's Psionic Shield is the
next entry on p. 68, Gambit's own pack).

## 2. Whole games (new)

Seeds are the first match of a deterministic search over 1..60, so a given run always finds the same game. Every game
is played from setup by the greedy driver, replayed with `replay(log)` and the final state compared with `toEqual`.
The second hero is Storm in Wolverine's 2-player game and Cyclops in Storm's.

| Game                                      | Variants                                         | What the game must contain (asserted from the replayed events)                                                                                            | Staged? |
| ----------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Wolverine vs Rhino, healing and berserker | 2 players standard (with Storm), 1 hero expert   | Healing Factor resolved (`35001a.wolverine-constant`, a `damageHealed` event) and Berserker Barrage resolved (`35008.berserker-barrage-action`)           | No      |
| Wolverine vs Rhino, the Claws             | 2 players standard (with Storm), 1 hero expert   | The Claws action resolved, playing Lunging Strike, the Claws exhausted, the event in the discard pile; then the driver plays to an outcome                | Yes     |
| Wolverine vs Rhino, Lady Deathstrike      | 2 players standard (with Storm), 1 hero expert   | Any ability of the set resolved (`3503[4-7]`: Lady Deathstrike's response, Seeking Vengeance, Adamantium Upgrades or Hack 'n' Slash)                      | No      |
| Storm vs Rhino, Weather                   | 2 players standard (with Cyclops), 1 hero expert | "I feel a storm coming..." resolved, a `cardsSwapped` (`leftAndEntered`) from Weather Control or Weather Goddess, and a Weather Special resolved after it | No      |
| Storm vs Rhino, The Shadow King           | 2 players standard (with Cyclops), 1 hero expert | Any ability of the set resolved (`3603[6-9]`: The Shadow King, Ruler of the Astral Plane, Possessed or Astral Attack)                                     | No      |

Staging, said plainly: the greedy driver never uses Wolverine's Claws (across seeds 1..6 in four variants the action never
resolved; its cost chooses an event from hand, which the driver may not generate), so that game is staged. Surgery: Lunging Strike is moved into hand, then the Claws are used through
`sessionApply` (so the prefix's log replays), a chain of two logs, each replayed deep-equal: the prefix equals the state
handed to `playToOutcome`, and that run's log equals its final state. Weather Control, Weather Goddess, Healing Factor and
Berserker Barrage are all reached by the driver unaided. No game wins (the greedy driver ends in a loss, as in the other
passes); an outcome is only required to exist. The older `e2e.test.ts` files already played each pack's solo, 2-player
and expert games.

## 3. Findings

No bug found in this pass. No `it.fails` was needed. The known "take damage" cost bug (RRG p. 14; `mojo/qa.test.ts`)
was not re-reported and was committed as fixed (3d004785) while this pass ran; the tests here do not depend on it.

**Decided: Q81, repeat only if all 2 taken (3bc5b946).** Berserker Barrage's repeat when the 2 damage is
prevented: with a tough status card (or a reduction) Wolverine takes less than 2 and the ability no longer repeats
(owner decision 2026-10-03; tests in `wolverine/events.test.ts`).

Not checked (thin coverage, said plainly):

- A card-by-card audit of the two packs against their scans: the module tests cover each card, this pass read only the
  cards that rulings, errata and interactions name.
- The Unflappable FAQ is about a Boost ability's damage against an "undefended" cost, not about Frenzy; it is used as the
  nearest FFG statement that a second source of damage during an attack is not the attack's damage. If FFG rules the
  other way for forced interrupts, the Omega Red test is the one to change.
- Pixie against Magik (FAQ p. 64) and the Aug 3 ruling's Odin as a real Hela game: Magik is not scripted, and wave 6's
  scenario builder cannot seat Hela, so Odin is seated by surgery from a patched card.
- Q26's edges for the Weather deck (a card that would go to a discard pile, hand or deck returns facedown) are pinned at
  engine level (`packages/engine/src/separate-deck-no-discard.test.ts`), not re-tested through card scripts here.
- Gentle, Mirage, Havok, Hangar Bay, Leadership Skill, Forge, Switchblade, Knife Fight and Callisto have no ruling or FAQ
  entry, so no QA test cites one; their behavior is covered only by the module tests.

## 4. Test record

- `cd packages/cards && pnpm exec vitest run src/wave6/wolv/qa.test.ts src/wave6/storm/qa.test.ts`: 32 passed (19
  Wolverine, 13 Storm), about 15 s.
