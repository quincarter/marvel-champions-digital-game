# Phase 7 wave 6 rules-QA: the modular set x scenario matrix (2026-10-04)

The owner decided on 2026-10-04 that Table setup will offer **every modular encounter set from the unlocked packs for any
scenario**, where the client offered only Core's five plus the scenario's recommendation. Before the picker is widened,
this pass built and played the pairings nobody had run. It adds tests only: no engine, builder or card code was touched,
and everything that failed is pinned with `it.fails` (they go red the day the code is fixed, so the pin is removed with
the fix).

Sources: RRG 1.8 "Modular Encounter Set" (printed p. 29, the table of contents' page; the brief said p. 28): modular sets
"can be added to and/or removed from nearly any scenario", "added to a scenario ... as an entire set", "unless specific
scenario rules state otherwise"; Appendix VI (p. 71): "A group may choose to play any scenario with any modular encounter
sets, regardless of the chosen environment(s)"; Appendix IV FAQ (p. 61): a set is modular unless it is scenario-specific
or campaign-specific; "Standard Set" (p. 40) and "Expert Set" (p. 19): never a modular choice; "Nemesis Encounter Set"
(p. 30); "Choose (Option)" (p. 12); "Setup (Keyword)" (p. 40) and setup step 11 (p. 51); "Search" (p. 39). FFG's ruling of
Feb 28, 2026 (8) answers a question about "Infiltrate the Museum + Infinity Gauntlet", so FFG itself treats a modular set
from another box in a scenario as an ordinary game. Page numbers are the printed ones (a `**_N_**` footer in the
Markdown precedes page N + 1).

## Fix status (branch `wt/modular-fixes`)

Every finding below is fixed and its pin flipped to a passing test; the open questions Q-M1 to Q-M4 are answered by the
owner and built. The sections after this one describe the matrix as first run (before the fixes), kept as the record.

| Finding    | Fixed in               | What changed                                                                                                                                                                                                                                                                                                  |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1         | `1eea0242`             | Core, wave 1 and wave 2 builders read encounter sets (modular picks included) from `PLAYABLE_CARDS` through core's one `encounterCardsOf`; `playableScenario`'s foreign-pick workaround is deleted                                                                                                            |
| F2         | `8d68e6f5`             | MaGog's `chooseModularSets` checks picks against `PLAYABLE_ENCOUNTER_SETS` (`modular-pool.ts`); Spiral and Mojo stay genre-only                                                                                                                                                                               |
| F3         | `02c09091`             | `modularSetupCardIds` deals a modular pick's `specificTo` setup-keyword card (the Milano) with the encounter deck so the engine's step 11 puts it into play, in every builder; a scenario that owns the set (four GMW scenarios) still sets it aside for its own Setup. No engine change needed               |
| F4         | `639e557f`             | "Exhaust the Milano" options (Blind Side, Hull Breach, Power Siphon, Special Delivery, and Cut the Power's boost) are gated on a ready Milano with `option(label, { when }, ...)`                                                                                                                             |
| F5, F6     | `edef844d`             | `chosenModularSetIds` / `modularPickProblem` (`modular-pool.ts`) in every builder: own set, Standard/Expert, nemesis, campaign, repeated, another scenario's set, zero-modular scenario, Gauntlet with several villains; `checkModularPickCount` in `playableScenario`; the picker offers exactly what builds |
| F7         | `77687b40`             | `setSeparateDecks` builds a set's separate deck (the Infinity Stone deck) in every builder, keyed on the set                                                                                                                                                                                                  |
| Q-M1       | `4e303cff`             | Bring the Hammer Down counts any card titled Ronan the Accuser as in play; engine: a unique encounter minion, side scheme or environment revealed beside its match is discarded and its revealer dealt another card (new `uniqueCheck` reveal stage)                                                          |
| Q-M2       | `382b114a`             | A player card that names "the villain" asks which villain when several are in play (`VILLAIN_CHOICE`); constant and keyword effects keep meaning the active villain                                                                                                                                           |
| Q-M3, Q-M4 | `9d491af5`             | Experimental Weapons is an ordinary pick except at Crossbones ("already part of" it); the print-and-play Kree Fanatic set is behind `UnlockPrefs.officialPrintAndPlay` (off by default), the Promo group hidden unless on                                                                                     |
| Exclusions | `9734bd9a`             | `MODULAR_SET_EXCLUSIONS` holds the Gauntlet at Tower Defense; Campaign Challenge is refused as a campaign set (flagged `campaignSpecific` in the data since 2026-10-04, override removed)                                                                                                                     |
| Cleanup    | `cb9fe9c7`, `4d667d41` | The matrix helper's staged workaround is removed (every pairing builds directly); Mansion Attack stage-walk tests avoid a villain whose title a Brotherhood minion shares                                                                                                                                     |

Full matrix after the fixes (`QA_MODULAR_FULL=1`, soak and reveal files): 244 tests pass in 2,086 s (34.8 minutes, other
agents' load on the machine); the default matrix run, the engine, cards and client view suites pass.

Remaining after the fixes: none of F1 to F7 and no `it.fails` in the matrix files. Both former open items are decided (section 7):
Campaign Challenge is campaign-only in the data with the override removed, and Tower Defense's setup-keyword attachment to
"the villain" goes to the first villain, Proxima Midnight (Q-M2).

## Files

| File                                                                                       | What it does                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`testing/modular-matrix.ts`](../packages/cards/src/testing/modular-matrix.ts)             | Derives the lists from content data; `pairingFor` / `buildPairing` (with a staged workaround for builder pool gaps); `revealOnTurnEnd`; `startPairing` |
| [`modular-matrix.test.ts`](../packages/cards/src/modular-matrix.test.ts)                   | Pins both lists (inline snapshots), the matrix shape, every pairing built (deck contents, ability refs, setup cards), F1-F3                            |
| [`modular-matrix-soak.test.ts`](../packages/cards/src/modular-matrix-soak.test.ts)         | Seeded greedy soak: 140-game rotating sample by default, every buildable pairing with `QA_MODULAR_FULL=1`                                              |
| [`modular-matrix-reveal.test.ts`](../packages/cards/src/modular-matrix-reveal.test.ts)     | Deals every card of every modular set to Rhino, Tower Defense or Kang, alter-ego and hero form (all three hosts with `QA_MODULAR_FULL=1`)              |
| [`modular-matrix-targeted.test.ts`](../packages/cards/src/modular-matrix-targeted.test.ts) | Cards that name a home villain, scheme, attachment or card, in a scenario without it; "the villain" in multi-villain hosts; F4-F7                      |

Run: `pnpm --filter @mc/cards exec vitest run src/modular-matrix` (about 3 minutes on an idle machine); the full matrix is
`QA_MODULAR_FULL=1 pnpm --filter @mc/cards exec vitest run src/modular-matrix-soak.test.ts src/modular-matrix-reveal.test.ts`.

## 1. The lists

**Modular sets: 70** (data-derived; pinned in `modular-matrix.test.ts`). A set is excluded when it holds a villain or main
scheme card (scenario-specific), is a nemesis set, is campaign-specific, is a Standard/Expert set (by flag or because a
scenario names it as its difficulty set), or is the one-card extra set. Cards per set in brackets.

| Pack             | Sets                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core             | bomb_scare (6), legions_of_hydra (6), masters_of_evil (7), the_doomsday_chair (6), under_attack (5)                                                                                                     |
| Green Goblin     | a_mess_of_things (5), goblin_gimmicks (8), power_drain (5), running_interference (5)                                                                                                                    |
| Red Skull        | exper_weapon (4), hydra_assault (6), hydra_patrol (6), weap_master (5)                                                                                                                                  |
| Kang             | anachronauts (9), mot (6), temporal (7)                                                                                                                                                                 |
| GMW              | badoon_headhunter (5), band_of_badoon (10), galactic_artifacts (9), kree_militant (9), menagerie_medley (9), power_stone (1), ship_command (6, plus the Milano), space_pirates (8)                      |
| Ronan P&P        | kree_fanatic (7)                                                                                                                                                                                        |
| MTS              | armies_of_titan (6), black_order (4), children_of_thanos (5), enchantress (5), frost_giants (6), infinity_gauntlet (7), legions_of_hel (7)                                                              |
| The Hood         | beasty_boys (4), brothers_grimm (5), crossfire_crew (6), mister_hyde (4), ransacked_armory (7), sinister_syndicate (7), state_of_emergency (6), streets_of_mayhem (4), wrecking_crew_modular (7)        |
| Sinister Motives | city_in_chaos (5), down_to_earth (6), goblin_gear (6), guerrilla_tactics (7), osborn_tech (6), personal_nightmare (7), sinister_assault (6), symbiotic_strength (9), whispers_of_paranoia (5)           |
| Hero packs       | armadillo (Nova, 6), zzzax (Ironheart, 7), inheritors (Spider-Ham, 9), ironspider_sinister (Iron Spider, 8), deathstrike (Wolverine, 6), shadow_king (Storm, 5), exodus (Gambit, 6), reavers (Rogue, 8) |
| Mutant Genesis   | acolytes (7), brotherhood (8), future_past (5), mystique (5), sentinels (7), zero_tolerance (7)                                                                                                         |
| MojoMania        | crime (6), fantasy (6), horror (6), sci-fi (7), sitcom (6), western (6)                                                                                                                                 |

**Extra set, kept apart:** `longshot` (MojoMania insert p. 2: one card, "can be included in any scenario", never counts
toward a scenario's modular count). Already covered by `modular-pool.test.ts` and the Mojo QA pass; not part of the matrix.

**Scenarios: 36** (Core 3, Green Goblin 2, Wrecking Crew's Breakout, Red Skull 6, GMW 5, MTS 6, The Hood, Sinister Motives
5 with Sinister Six, Mutant Genesis 5, MojoMania 3). Modular count 1 for most; 2 for Red Skull, Ebony Maw, Thanos, Hela,
Loki and Sabretooth; 3 for Crossbones and Spiral; 0 for Breakout, The Hood (seven of its own nine sets set aside), Sinister
Six and Mojo (1 + 1 per hero genre sets set aside).

**Classification calls the data does not settle (for the owner / `card-data-pipeline`):**

- `challenge` (GMW Campaign Challenge side schemes, 16178-16187): decided 2026-10-04, campaign-only in the data
  (`campaignSpecific` through the GMW curation); the `CLASSIFICATION_OVERRIDES` entry is gone.
- `exper_weapon` (Experimental Weapons) is Crossbones' second required set but carries no scenario name; by the FAQ's
  definition it is modular, so it pairs with every other scenario (and is "required", not a pairing, at Crossbones).
- The GMW companions Ship Command, Power Stone and Galactic Artifacts (and Hydra Patrol, Experimental Weapons) are required
  by home scenarios yet named modular by the FAQ: modular everywhere except their home scenarios.
- `kree_fanatic` is a Print and Play promotional set ("Ronan the Accuser Print and Play Modular Set", cards 90001-90005).
  Treated as playable and modular; whether "unlocked packs" includes promos is an owner call.
- Hero obligation sets are not encounter sets in the data (hero cards), so there is nothing to exclude.
- Campaign sets with no cards (hydra_camp, the_market, brawler, commander, defender, peacekeeper) are excluded and pinned empty.

## 2. Pairings that build

70 sets x 36 scenarios = 2,520 pairings.

| Kind                                   | Pairings | Why                                                                                                                                                                                                             |
| -------------------------------------- | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                                  |    2,162 | `playableScenario(scenario, { modularSetIds, setAsideModularSetIds })` with the set alone, or with the scenario's own recommended sets (then Core's five) as fillers where it asks for 2 or 3                   |
| Required by the scenario               |       20 | The set is already in `encounterSetIds` (Ship Command at four GMW scenarios, Power Stone, Galactic Artifacts, Hydra Patrol, Infinity Gauntlet at Thanos and Loki, ...): shuffling it twice is not a choice      |
| Restricted by the scenario's own rules |      338 | Breakout 70, The Hood 70, Sinister Six 69 (no modular sets); Spiral 64 and Mojo 64 (the six genre sets only, Q44); Tower Defense 1 (Infinity Gauntlet, MC21 p. 16: "cannot be used" with more than one villain) |

Of the 2,162 that build: **1,460 build directly; 702 are refused by the builder** (F1: 653, F2: 49) and were built through
a staged workaround (the same game with the set's cards swapped for a stand-in set's) so they could still be checked and
played. Each pairing is built solo and standard; a rotating quarter again in expert (539 builds) and a rotating tenth with
two players (219 builds, which matters for Mojo's per-player set-aside count). Per build: `createGame` succeeds; every card
of the set is in the game exactly as often as printed (back faces of double-sided cards excepted); setup leaves no pending
choice that cannot be answered and no outcome; every ability ref of every modular card is registered (**no unscripted card
in any of the 70 sets**); every card of the set with the setup keyword, and a scenario-specific card of the set (the
Milano), starts in play (direct builds only).

## 3. Pairings that play

**Rotating sample (default).** 140 games: every set twice, the scenario each time the eligible one used least so far, so
every one of the 33 scenarios that takes a modular set is hit at least twice (asserted); one game in five expert, one in
seven two-player. Greedy driver, 30 commands per seat (two to three rounds; 36 in the full run). Per game: no rejected
command, no throw, no pending choice with too few options, replay from the seed deep-equal, no `encounterDeckExhausted`
before round 3, and the game reached round 2 or ended. **All 140 passed; 85 s wall** (141 tests with the shape check, load
average about 2 from other agents' work, so close to but not an idle machine; 104 s at 36 commands).

**Full matrix, run once:** 2,595 games (every buildable pairing solo and standard, a rotating tenth again with two seats,
every twentieth of those expert), 844 of them through the staged workaround. **All pass; 2,333 s wall (38.9 minutes)**
with load average 6 to 9 from other agents' work (an idle machine would be quicker). No rejected command, throw, stuck
choice or replay divergence. Outcomes: 1,489 still running at the command cap, 577 lost to every hero defeated, 442 to the
main scheme, 87 to a card ability (35 at Sabretooth, 23 at Project Wideawake from Operation Zero Tolerance, 1 at Tower
Defense from Avengers Tower: each scenario's own loss clause against a hero the greedy driver does not protect; the other
28 are in scenarios not broken down), none to `encounterDeckExhausted`. The first full run flagged three games: two
were the "reached round 3" assertion tripping on a game that used its 36 commands in two rounds, one a Sabretooth game
lost in round 1 when Vision's Get Behind Me! sent the damage to Robert Kelly (a printed loss clause, not a bug); the
assertions were relaxed (round 2; a card-ability loss is counted, not failed) and the rerun is the one reported.

**Reveal sweep.** Every card of every modular set is dealt to a host scenario by the villain phase, in alter-ego and in
hero form, stacked behind the villain's boost cards. Default (one host per set, rotating Rhino, Tower Defense, Kang): 672
reveals, 71 tests. Full (all three hosts): **2,022 reveals, 211 tests, all pass, 116 s wall.** No throw, no unanswerable
choice, no loss by a card's own text or by an empty encounter deck in the first villain phase. 18 cards are not dealt (the
Setup attachments start in play; a few cards were already out of Kang's deck at setup).

## 4. Findings

Severity: High = a printed card or set cannot work as printed in a pairing the picker would offer; Medium = wrong but a
workaround exists; Low = validation only (the picker is the guard).

| Id  | Pairing                                                                                                                                                                                                                                                                 | What happened                                                                                                                                                                                                                                                                                                                                                                                                                     | Expected (cite)                                                                                                                                                                                                                                                                    | Severity | Proposed owner                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Any set of a later wave in Rhino, Klaw, Ultron, Risky Business, Mutagen Formula, Crossbones, Absorbing Man, Taskmaster, Zola, Red Skull, Kang (653 pairings)                                                                                                            | The Core, wave 1 and wave 2 builders read encounter cards from their own wave's pool (`wave1EncounterCardsOf`, `wave2EncounterCardsOf`, `encounterCardsOf`'s Core default), so `playableScenario` throws `encounter set X has no Core / wave 1 / wave 2 cards` for every set from another pack (for example Exodus in Rhino); 58 to 61 of the 70 sets per scenario                                                                | A modular set goes in "nearly any scenario" (RRG p. 29), "any scenario with any modular encounter sets" (p. 71): the card pool is `PLAYABLE_CARDS`, which the builders hand to the engine after the fact                                                                           | High     | `ability-scripting-engineer` (scenario builders in `packages/cards/src/{core,wave1,wave2}/setup.ts`)                                                                                 |
| F2  | Any set outside Core and cycle 6 in MaGog (49 pairings)                                                                                                                                                                                                                 | `wave6/setup.ts` checks picks against `[...CORE_ENCOUNTER_SETS, ...WAVE6_ENCOUNTER_SETS]`, so `chooseModularSets` throws `MaGog: X is not a modular set` for every set of waves 1 to 5                                                                                                                                                                                                                                            | MaGog 39002a's pool is unrestricted ("1 random modular set from the MojoMania scenario pack" is the italic recommendation): the players may name any modular set (docs/phase7-wave6.md §3.63)                                                                                      | Medium   | `ability-scripting-engineer` (`wave6/setup.ts` `ENCOUNTER_SETS`; pass `PLAYABLE` sets)                                                                                               |
| F3  | Ship Command in 15 scenarios where it is not required: Infiltrate the Museum, Ebony Maw, Thanos (as a second set it is allowed), Hela, Loki, Tower Defense, Sandman, Venom, Mysterio, Venom Goblin, Sabretooth, Project Wideawake, Master Mold, Mansion Attack, Magneto | The Milano (16142, "Permanent. Setup.", a support that belongs to the set through `specificTo`) is either never in the game (cycle 4 and 6 builders) or set aside and never put into play (wave 3 and 4 builders: only a GMW Ship Command scenario's own Setup text does that). Rogue Vessel and Cannonade then have nothing to exhaust; Rogue Vessel (Surge, 1 damage to each player every villain phase) can never be discarded | A card with the setup keyword "begins the game in play"; setup step 11: "Search each deck and the set aside area for any cards with the setup keyword and put them into play" (RRG pp. 40, 51). The Power Stone and the Infinity Gauntlet (in the encounter deck) do start in play | High     | `game-rules-architect` (step 11 searches decks only, not the set-aside area); `ability-scripting-engineer` (wave 5 and 6 builders never include `specificTo` set cards, wave 3 does) |
| F4  | Blind Side 16145, Hull Breach 16146, Power Siphon 16147, Special Delivery 16148 in any game without the Milano (F3's games)                                                                                                                                             | The choice still lists "Exhaust the Milano" and the first (default) answer takes it: with no Milano that is a free no-op, so the treachery does nothing                                                                                                                                                                                                                                                                           | "When an encounter card requires a player to choose an option, they cannot choose an option that requires one or more targets if there are no valid targets for that option" (RRG p. 12)                                                                                           | Medium   | `ability-scripting-engineer` / `game-rules-architect` (option legality for `exhaust(named(...))` with no valid target)                                                               |
| F5  | A pick the scenario already requires, its own villain set, a Standard set, a nemesis set or a repeat, at any scenario without a modular pool (every pairing a careless picker could offer)                                                                              | Wave 1 to 6 builders (all but MaGog, Spiral and Mojo, whose `chooseModularSets` validates) shuffle in whatever `modularSetIds` says: Nebula + Ship Command deals 12 Ship Command cards, Rhino + Rhino 34 cards, Sandman + Standard 14, Sandman + Colossus nemesis shuffles the nemesis set in                                                                                                                                     | "Added ... as an entire set" (p. 29); the Standard set and Expert set "cannot be selected" (pp. 40, 19); a nemesis set belongs to its hero (p. 30)                                                                                                                                 | Low      | `ability-scripting-engineer` (route every builder through `chooseModularSets`)                                                                                                       |
| F6  | A pick at The Hood or Breakout (dropped silently), Sinister Six (added although it takes none), Infinity Gauntlet at Tower Defense (builds)                                                                                                                             | The Hood and Breakout ignore `modularSetIds`; Sinister Six shuffles the set in; Tower Defense builds with the Gauntlet set                                                                                                                                                                                                                                                                                                        | A scenario with a modular count of 0 takes none (the scenario's setup); "If there is more than one villain ... The Infinity Gauntlet set cannot be used" (MC21 p. 16)                                                                                                              | Low      | `ability-scripting-engineer` (same fix as F5)                                                                                                                                        |
| F7  | Infinity Gauntlet in any scenario but a Mad Titan's Shadow one: 14 direct builds across waves 3, 5 and 6, plus the staged ones (probed at Sandman, Infiltrate the Museum, Magneto)                                                                                      | Only `wave4/setup.ts` honors `EncounterSet.separateDecks`. Elsewhere the six Infinity Stones are shuffled into the encounter deck and there is no Infinity Stone deck, so the Gauntlet's Forced Response puts nothing into play and the stones are revealed as ordinary environments                                                                                                                                              | The six stones are set aside as the Infinity Stone deck at setup (MC21 p. 16); FFG's Feb 28, 2026 (8) treats the Gauntlet in Infiltrate the Museum as a normal game whose stones go to the discard pile after their Special                                                        | High     | `ability-scripting-engineer` (builders build `separateDecks` of any set in the game, as the wave 4 builder does)                                                                     |

What did not turn up: no set has an unregistered ability ref; every pairing that builds deals each card exactly as printed;
no soak game threw, got stuck, diverged on replay or lost to a card's own text; no card text in the reveal sweep failed to
resolve in a foreign scenario. The named-card fallbacks all print as the cards say (section 5).

## 5. Targeted tests (`modular-matrix-targeted.test.ts`)

Passing, each against the printed text:

- **Zero Tolerance, Sentinels, Brotherhood** away from Master Mold, Project Wideawake and Mansion Attack (Rhino): Sentinel
  Mark II (32101) searches Operation Zero Tolerance (32104) out of the deck, surges when it is already in play, and with it
  gone finds nothing and carries on; Mark V (32105) fetches Targeted for Elimination onto the identity and with both copies
  gone finds nothing; Mutant Terrorists (32078) reveals The Brotherhood (32079), or with it in play a Brotherhood of Mutants
  minion.
- **Acolytes and Exodus** with no Acolyte in the game: Zeal for the Cause (32164) reveals the next minion; Acolyte Frenzy
  (37035) gains surge, as printed.
- **Kang (Master of Time)** Ancient Grudge (11051) fetches him engaged; **Bring the Hammer Down** (90004) in Ronan the
  Accuser's own scenario gains surge (the engine reads "Ronan the Accuser" as the minion; Q-M1).
- **Mystique** (Sandman, Rhino): her treacheries stay in the hand without the wave 6 scenario rule (the card's own
  hand-active Forced Response keeps them there, `rules.ts` `staysInHand`), and she stops attacks on the villain while she
  herself can be attacked.
- **Setting environments across packs:** Dial M for Mojo (MojoMania) discards Back-Alley Enclave (The Hood), both SETTING.
- **"Attach to the villain"** (Pumpkin Bombs) attaches to a villain of the game at Tower Defense, Kang (Kang the
  Conqueror), Mansion Attack (the random villain) and Ronan the Accuser; Power Stone starts on the villain at Rhino and on
  the first villain at Tower Defense (Q-M2).
- **Infinity Gauntlet** at Ebony Maw: six stones in the Infinity Stone deck, Gauntlet on the villain (the control for F7).

Pinned with `it.fails`: F4 (4 cards), F5 (6 picks), F6 (4 cases), F7 (3 hosts); in `modular-matrix.test.ts` F1, F2, F3.

## 6. Picker exclusions (as built)

Rule-based, in `packages/client/src/view/modular-exclusions.ts` (listed disabled with a short reason):

1. Infinity Gauntlet at Tower Defense: "Needs one villain (MC21 p. 16)" (`EncounterSet.singleVillainOnly`).

Never offered at all, because the candidate list is built from `modularPickProblem` (the same check the builders make):
a set the scenario already has (its own sets, each villain's; Experimental Weapons at Crossbones, Q-M3), Standard and
Expert sets, nemesis and campaign sets (Campaign Challenge included), another scenario's own set, anything at Breakout,
The Hood and The Sinister Six (modular count 0), anything but the six genre sets at Spiral and Mojo (Q44). MaGog takes any
set. Bug-based exclusions (old items 5 to 8) are gone: F1, F2, F3, F4 and F7 are fixed.

## 7. Open questions

Answered by the owner (2026-10-04) and built:

- **Q-M1.** Any in-play card titled Ronan the Accuser counts for "if Ronan the Accuser is not in play", the villain too.
  Beside the Ronan villain the Kree Fanatic minion cannot enter play: it is discarded and its revealer is dealt another card
  (RRG "Unique Icon", pp. 45-46; `modular-owner-answers.test.ts`, `engine/src/unique.test.ts`).
- **Q-M2.** A player card that targets "the villain" lets the player choose any villain in play; a keyword or constant
  effect on a player card means the active villain (`engine/src/multi-villain.test.ts`). For encounter cards "attach to the
  villain" uses the active villain where there is an active counter. Decided 2026-10-04: Tower Defense at setup step 11 (Power Stone's Setup keyword), where the active villain is not yet named (Focused Defense does it in step 12): the stone attaches to the first villain, Proxima Midnight, because step 11 resolves before an active villain is named and the scenario text gives no choice (no behavior change; pinned in `modular-matrix-targeted.test.ts`). No other scenario in the pool falls in that bucket: Breakout, The Sinister Six and Tower Defense all
  have an active counter, Breakout and The Sinister Six take no modular set, and the Gauntlet cannot be used at Tower Defense.
- **Q-M3.** Experimental Weapons: part of Crossbones, an ordinary modular pick elsewhere.
- **Q-M4.** The Kree Fanatic print-and-play set is official content outside any retail pack: its own opt-in
  (`UnlockPrefs.officialPrintAndPlay`, off on a fresh profile), the Promo group hidden unless on. No Settings control yet.

Decided 2026-10-04:

- **Campaign Challenge.** RRG 1.8 FAQ "Modular Encounter Sets" (p. 61) lists eight modular sets for Galaxy's Most Wanted
  and Campaign Challenge is not among them; "campaign-specific" is "containing the word 'Campaign' in its encounter set name
  area", which "Campaign Challenge" does. `docs/phase7-wave3.md` section 4 Q3 recorded the opposite (modular). Decided
  2026-10-04: campaign-only in data (`campaignSpecific`, set through the GMW curation's `encounterSets`); the overrides in
  `modular-pool.ts` and `testing/modular-matrix.ts` are removed.
- **Q-M5.** The brief cites "Modular Encounter Set" at p. 28; the table of contents prints 29. This pass cites printed pages.

## 8. Thin or untestable

- Cards whose reveal needs a second player, a particular hero, or a state the greedy driver never reaches (a Tough ally
  under Fallen Warrior, a Web-Warrior in play for the Inheritors) are exercised only to "reveals and resolves"; their printed
  conditions are not asserted. Two-player reveals are covered by the soak only.
- The reveal sweep reaches a card at the first villain phase of a host; mid-game interactions (Rogue Vessel's damage
  against a hero already on the brink, ratings counters over many rounds) are not asserted.
- (Fixed) The 702 pool-gap pairings were once checked through a staged workaround; every pairing now builds directly.
- Unlocked-pack gating (which sets a given player has) is not modeled: the matrix assumes every pack is unlocked.
