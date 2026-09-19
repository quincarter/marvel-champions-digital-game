import {
  addVillain,
  atEndOfPhase,
  cards,
  chooseOne,
  chosen,
  completeMainScheme,
  constant,
  createGameArea,
  dealEncounterCard,
  defineAbilities,
  eachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  joinGameArea,
  modifyAttack,
  moveCards,
  named,
  on,
  option,
  placeThreat,
  query,
  removeMainSchemeStage,
  self,
  selectCards,
  setup,
  shuffleEncounterDeck,
  stateCheck,
  theMainScheme,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { areaPlayersDefeated } from "../../dsl/values.js";
import { encounterSetAside } from "../../dsl/effects.js";
import { cardName } from "../names.js";

/**
 * The Once and Future Kang scenario (`kang` encounter set, plus the recommended Temporal modular set): Kang (I)
 * alone in the villain deck (11001), Kang (II)'s four versions set aside for the main scheme's own stage 3
 * alternatives (11002–11005), Kang (III) set aside for stage 4 (11006), the main scheme "Kang's Arrival" →
 * "The Master of Time" → one random stage 3 per area → "Kang's Wrath" (11007a–11013b), and the Kang/Temporal
 * encounter sets (11014–11033). Expert mode substitutes 11034–11039 for 11001–11006 (same printed text, reused
 * bodies below) and adds the Expert encounter set (11040–11051, not yet scripted — see module docblock).
 *
 * **The whole scenario depends on separate game areas** (docs/phase7-wave2.md §3.1, landed): `createGameArea`,
 * `joinGameArea`, `addVillain`, `completeMainScheme`, `removeMainSchemeStage`, `stateCheck`, `areaPlayersDefeated`.
 * `packages/engine/src/game-areas.test.ts`'s synthetic Kang-shaped scenario is the reference this module's stage 3
 * abilities are modeled on almost verbatim.
 *
 * **Skipped (missing engine primitive or open rules question — see docs/phase7-wave2-scripting.md):**
 * - `11008b.the-master-of-time-forced-interrupt` — "When an acceleration token would be placed on another scheme,
 *   place it here instead." docs/phase7-wave2.md §4.3 (open question): which area's stage 3 the central stage's own
 *   tokens redirect *to* isn't settled by any landed primitive (the engine's own proposed reading, §3.1, is that
 *   central tokens add to *every* area's step one directly — a different mechanism than "redirect placement to
 *   stage 2B" this card's text asks for). No primitive intercepts "an acceleration token would be placed" as an
 *   interruptible event today.
 * - `11008b.the-master-of-time-constant` — "Players cannot join this game area unless there are no other game
 *   areas remaining. When all the players have joined this game area, advance to stage 4A." The second sentence is
 *   `stateCheck(not(gameAreasSplit), advanceMainScheme(...))` (used by `packages/engine/src/game-areas.test.ts`'s
 *   own stage 2), but the first is a `RuleSpec` this engine doesn't have (no "cannot join area X unless condition"
 *   restriction), and the two need different `AbilityTriggerSpec` kinds (`constant` vs `stateCheck`) — one ref
 *   can't carry both, and dropping "cannot join early" would let a player join stage 2B before every other area
 *   has dissolved, a real behavior change, not a cosmetic omission. Closest existing primitive: `RuleSpec
 *   cannotAttack`/`cannotThwart`'s shape (a standing restriction with a `while`), generalized to game areas.
 * - `11013a.when-revealed` — "Reveal Kang (III) and add him to the game area. Reveal each face down Kang's
 *   Dominion under this stage." The first sentence is `addVillain(..., { reveal: true })` (scripted, matching the
 *   reference test's stage 4); the second needs "reveal a facedown card tucked under this card, putting it into
 *   play as itself" — `tuckedUnder(theMainScheme)` (`dsl/effects.ts`) finds the tucked cards, but there is no
 *   effect that un-tucks a facedown card into play (RRG 1.8 "Reveal" (p. 37) covers a card *drawn* face down, not
 *   one already tucked). Closest existing primitive: `flipCard` (turns a card already in play), which doesn't
 *   apply to a tucked, out-of-play card.
 * - `11013b.when-revealed` — "Each player searches the encounter deck, discard pile, and set-aside area for their
 *   nemesis minion and puts it into play engaged with them." Needs *both* a per-player "their own nemesis card"
 *   selector (nemesis sets are per-player `PlayerState.setAside`, docs/phase7-wave2-scripting.md §5, but there is
 *   no `TargetQuery` for "the minion belonging to *that* player's own nemesis set" the way `defeatingPlayer` now
 *   reads an event's own player) *and* a zone search spanning `setAside` (the same "deck+discard+play area" gap
 *   `04028.when-revealed`, `hawkeye-obligation-nemesis.ts`, is skipped for — `zone()`'s multi-zone search only
 *   spans `"hand" | "deck" | "discard"`, no `setAside`).
 * - `11007b.when-revealed` and `11013b.when-revealed` each carry only one ability ref for text with two distinct
 *   clauses (the "When Revealed" sentence, scripted below for 11007b and skipped above for 11013b, plus a "When
 *   Completed Abilities" (RRG 1.8 p. 48) "If this stage is completed, the players lose the game" sentence with no
 *   ref of its own — the same data-shape gap Captured by Hydra (04107, `taskmaster.ts`) has for its "When
 *   Defeated" half). **Data gap flagged for `card-data-pipeline`.**
 */

/** "Toughness (data). [star] Forced Interrupt: When Kang attacks you, either place 1 threat on the main scheme, or he gets +2 ATK for this attack." (Kang (I)/Kang (III), standard and expert). */
const KANG_ATTACKS_YOU_FORCED_INTERRUPT = forcedInterrupt(
  on.villainAttacks({ againstYou: true }),
  chooseOne(option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)), option("He gets +2 ATK for this attack", modifyAttack({ atkBonus: 2 }))),
);
/** "When Defeated: Advance the main scheme to stage 2 at the end of the phase." (Kang (I), standard and expert). */
const KANG_I_WHEN_DEFEATED = { trigger: { kind: "whenDefeated" } as const, effects: [atEndOfPhase({ kind: "advanceMainScheme" as const, to: { stageNumber: 2 } })] };
/** "When Defeated: The players win the game." (Kang (III), standard and expert). */
const KANG_III_WHEN_DEFEATED = { trigger: { kind: "whenDefeated" } as const, effects: [{ kind: "endGame" as const, result: "win" as const }] };

/**
 * "When Defeated: Remove <stage> from the game. At the end of the phase, join another game area." (each Kang
 * (II)). `stageName` is the stage's own printed title (`MainSchemeStage.name`) — not a separate card id: all four
 * stage 3 alternatives share the one "Kang's Arrival" card id (11007a), told apart only by stage number/name
 * (docs/phase7-wave2.md §1.6), so `cardName(code)` (a lookup by `AnyCard.id`) doesn't apply here. `named(...)`
 * still matches correctly: `currentName` (`packages/engine/src/query.ts`) reads a main scheme instance's *current
 * stage's own* name when it has one.
 */
const kangIIWhenDefeated = (stageName: string) => ({
  trigger: { kind: "whenDefeated" as const },
  effects: [removeMainSchemeStage(named(stageName)), atEndOfPhase(joinGameArea())],
});

export const KANG_SET = defineAbilities({
  // Kang (I) (11001) and its expert copy (11034).
  "11001.kang-the-conqueror-forced-interrupt": KANG_ATTACKS_YOU_FORCED_INTERRUPT,
  "11001.when-defeated": KANG_I_WHEN_DEFEATED,
  "11034.kang-the-conqueror-forced-interrupt": KANG_ATTACKS_YOU_FORCED_INTERRUPT,
  "11034.when-defeated": KANG_I_WHEN_DEFEATED,

  // Kang (Immortus) (11002/11035) — This villain cannot take damage while a minion is in play. When Defeated:
  // remove the Chronopolis from the game and (at the end of the phase) join another game area.
  "11002.kang-immortus-constant": constant({ rules: [{ kind: "cannotTakeDamage", target: query("villain", { self: true }), while: { kind: "exists", query: query("minion") } }] }),
  "11002.when-defeated": kangIIWhenDefeated("The Chronopolis"),
  "11035.kang-immortus-constant": constant({ rules: [{ kind: "cannotTakeDamage", target: query("villain", { self: true }), while: { kind: "exists", query: query("minion") } }] }),
  "11035.when-defeated": kangIIWhenDefeated("The Chronopolis"),

  // Kang (Iron Lad) (11003/11036) — Retaliate 1, Toughness (data). When Defeated: remove Inexorable Fate.
  "11003.when-defeated": kangIIWhenDefeated("Inexorable Fate"),
  "11036.when-defeated": kangIIWhenDefeated("Inexorable Fate"),

  // Kang (Rama-Tut) (11004/11037) — [star] +1 ATK for each obligation in play. When Defeated: remove The Realm of
  // Rama-Tut.
  "11004.kang-rama-tut-constant": constant(gets("atk", { kind: "count", query: query("obligation") }, query("villain", { self: true }))),
  "11004.when-defeated": kangIIWhenDefeated("The Realm of Rama-Tut"),
  "11037.kang-rama-tut-constant": constant(gets("atk", { kind: "count", query: query("obligation") }, query("villain", { self: true }))),
  "11037.when-defeated": kangIIWhenDefeated("The Realm of Rama-Tut"),

  // Kang (Scarlet Centurion) (11005/11038) — [star] This villain's attack(s) gain(s) piercing. When Defeated:
  // remove The Present Future War.
  "11005.kang-scarlet-centurion-constant": constant(gainsKeyword({ name: "piercing" }, query("villain", { self: true }))),
  "11005.when-defeated": kangIIWhenDefeated("The Present Future War"),
  "11038.kang-scarlet-centurion-constant": constant(gainsKeyword({ name: "piercing" }, query("villain", { self: true }))),
  "11038.when-defeated": kangIIWhenDefeated("The Present Future War"),

  // Kang (III) (11006/11039).
  "11006.kang-the-conqueror-forced-interrupt": KANG_ATTACKS_YOU_FORCED_INTERRUPT,
  "11006.when-defeated": KANG_III_WHEN_DEFEATED,
  "11039.kang-the-conqueror-forced-interrupt": KANG_ATTACKS_YOU_FORCED_INTERRUPT,
  "11039.when-defeated": KANG_III_WHEN_DEFEATED,

  // Kang's Arrival 1A — Setup: (Kang II/III and Kang's Dominion set aside — the scenario builder's own
  // `setAsideVillainCardIds`/`setAside`, the same choice Taskmaster's Captive allies and Red Skull's Sleeper use).
  // Remove each player's obligation cards from the game (an exact reading, not an approximation: `includeIdentitySets`
  // shuffles in exactly one seated player's own obligation per copy and no others, so "every obligation-type card in
  // the deck" and "each player's own obligation cards" name the identical set here). Shuffle the encounter deck.
  "11007a.setup": setup(
    selectCards("obligations", { kind: "encounter", zones: ["deck"], filter: query("obligation") }),
    moveCards(cards(chosen("obligations")), "removedFromGame"),
    shuffleEncounterDeck(),
  ),
  // Kang's Arrival — When Revealed: deal each player an encounter card. (The "if completed, lose" half has no
  // ability ref — module docblock.)
  "11007b.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),

  // The Master of Time 2A — When Revealed: place 1 acceleration token here for each side scheme in play, then
  // discard each side scheme. Each player reveals a random stage 3A in turn order. Remove any unused stage 3
  // schemes from the game.
  "11008a.when-revealed": whenRevealed(
    { kind: "addCounters", counterType: "acceleration", amount: { kind: "count", query: query("sideScheme") }, target: theMainScheme },
    { kind: "discardFromPlay", target: { kind: "each", query: query("sideScheme") } },
    { kind: "revealMainSchemeStage", player: eachPlayer, stageNumber: 3, removeUnused: true },
  ),

  // The Chronopolis 3A (Kang (Immortus)'s stage) — When Revealed: create your own game area and place this scheme
  // in it. Add Kang (Immortus) to the game area and deal yourself an encounter card.
  "11009a.when-revealed": whenRevealed(
    createGameArea(self),
    selectCards("kang", encounterSetAside({ name: cardName("11002") })),
    addVillain(chosen("kang")),
    dealEncounterCard(you),
  ),
  // The Chronopolis 3B — If all the players at this stage are defeated, this stage is complete.
  "11009b.the-chronopolis-constant": stateCheck(areaPlayersDefeated, completeMainScheme(self)),
  // The Chronopolis 3B — Forced Response: after this stage is complete, place 1 set-aside Kang's Dominion facedown
  // under stage 4A. At the end of the phase, remove Kang (Immortus) and this stage from the game and combine your
  // game area with another game area. (The tuck target is the *central* stage 4A, not this area's own scheme —
  // stage 4 stays central until every area has joined, docs/phase7-wave2.md §3.1.)
  "11009b.the-chronopolis-forced-response": forcedResponse(
    on.mainSchemeCompleted("self"),
    selectCards("dominion", encounterSetAside({ name: cardName("11023") })),
    { kind: "tuckCards", cards: cards(chosen("dominion")), under: { kind: "mainScheme", of: "central" }, facedown: true },
    removeMainSchemeStage(self),
    atEndOfPhase(joinGameArea()),
  ),

  // Inexorable Fate 3A (Kang (Iron Lad)'s stage).
  "11010a.when-revealed": whenRevealed(
    createGameArea(self),
    selectCards("kang", encounterSetAside({ name: cardName("11003") })),
    addVillain(chosen("kang")),
    dealEncounterCard(you),
  ),
  "11010b.inexorable-fate-constant": stateCheck(areaPlayersDefeated, completeMainScheme(self)),
  "11010b.inexorable-fate-forced-response": forcedResponse(
    on.mainSchemeCompleted("self"),
    selectCards("dominion", encounterSetAside({ name: cardName("11023") })),
    { kind: "tuckCards", cards: cards(chosen("dominion")), under: { kind: "mainScheme", of: "central" }, facedown: true },
    removeMainSchemeStage(self),
    atEndOfPhase(joinGameArea()),
  ),

  // The Realm of Rama-Tut 3A (Kang (Rama-Tut)'s stage).
  "11011a.when-revealed": whenRevealed(
    createGameArea(self),
    selectCards("kang", encounterSetAside({ name: cardName("11004") })),
    addVillain(chosen("kang")),
    dealEncounterCard(you),
  ),
  "11011b.the-realm-of-rama-tut-constant": stateCheck(areaPlayersDefeated, completeMainScheme(self)),
  "11011b.the-realm-of-rama-tut-forced-response": forcedResponse(
    on.mainSchemeCompleted("self"),
    selectCards("dominion", encounterSetAside({ name: cardName("11023") })),
    { kind: "tuckCards", cards: cards(chosen("dominion")), under: { kind: "mainScheme", of: "central" }, facedown: true },
    removeMainSchemeStage(self),
    atEndOfPhase(joinGameArea()),
  ),

  // The Present Future War 3A (Kang (Scarlet Centurion)'s stage).
  "11012a.when-revealed": whenRevealed(
    createGameArea(self),
    selectCards("kang", encounterSetAside({ name: cardName("11005") })),
    addVillain(chosen("kang")),
    dealEncounterCard(you),
  ),
  "11012b.the-present-future-war-constant": stateCheck(areaPlayersDefeated, completeMainScheme(self)),
  "11012b.the-present-future-war-forced-response": forcedResponse(
    on.mainSchemeCompleted("self"),
    selectCards("dominion", encounterSetAside({ name: cardName("11023") })),
    { kind: "tuckCards", cards: cards(chosen("dominion")), under: { kind: "mainScheme", of: "central" }, facedown: true },
    removeMainSchemeStage(self),
    atEndOfPhase(joinGameArea()),
  ),
});
