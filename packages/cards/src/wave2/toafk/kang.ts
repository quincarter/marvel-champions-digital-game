import { trait } from "@mc/content";
import {
  addVillain,
  atEndOfPhase,
  cards,
  centralMainScheme,
  chooseOne,
  chosen,
  completeMainScheme,
  constant,
  createGameArea,
  dealEncounterCard,
  defineAbilities,
  eachPlayer,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  gets,
  joinGameArea,
  modifyAttack,
  moveCards,
  named,
  not,
  on,
  option,
  placeThreat,
  putIntoPlay,
  query,
  removeMainSchemeStage,
  revealCard,
  self,
  selectCards,
  setup,
  shuffleEncounterDeck,
  stateCheck,
  theMainScheme,
  thatPlayer,
  tuckedUnderRef,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { areaPlayersDefeated, gameAreasSplit } from "../../dsl/values.js";
import { anyOfCards, encounterCards, encounterSetAside, setAside } from "../../dsl/effects.js";
import { cardName } from "../names.js";

/** The trait every Kang/Temporal modular-set obligation carries, distinguishing it from a player's own identity
 * obligation (untraited) — see `11007a.setup`'s own comment. */
const TEMPORAL = trait("TEMPORAL");

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
 * **Un-skipped this pass (docs/phase7-wave2.md §10, all four primitives landed 2026-09-19):**
 * - `11008b.the-master-of-time-forced-interrupt` — "When an acceleration token would be placed on another scheme,
 *   place it here instead." is now `constant(rule({ kind: "accelerationTokenDestination", to: self }))` (§10.3):
 *   a constant redirect read at the moment a token is placed, not an interruptible event — deliberately, so a
 *   token already headed for the rule's own scheme isn't re-redirected and the encounter-deck reset's own placement
 *   order is unaffected.
 * - `11008b.the-master-of-time-constant` — "Players cannot join this game area unless there are no other game
 *   areas remaining." needs **no rule at all** (§10.4): the engine's join procedure already only ever offers the
 *   separate areas as destinations, dissolving into the central area exclusively when none remain, so the
 *   restriction the card prints is a restatement of the existing procedure, not a new one. "When all the players
 *   have joined this game area, advance to stage 4A." is `stateCheck(not(gameAreasSplit), advanceMainScheme(...))`,
 *   the same shape `packages/engine/src/game-areas.test.ts`'s own stage 2 uses.
 * - `11013a.when-revealed` — "Reveal Kang (III) and add him to the game area." is `addVillain(..., { reveal: true
 *   })`. "Reveal each face down Kang's Dominion under this stage." is now `revealCard(tuckedUnderRef(
 *   centralMainScheme), firstPlayer)` (§10.2): `TargetRef { kind: "tuckedUnder" }` names the tucked cards directly
 *   (the `tuckedUnder` `CardSelector` in `dsl/effects.ts` only ever named them for a *selector* position, e.g.
 *   `moveCards`/`chooseCards`; `revealCard` takes a `TargetRef`), and `revealCard` already runs the whole reveal
 *   procedure on whatever it names, tucked cards included, so no separate "un-tuck" effect was needed once the ref
 *   existed. `firstPlayer` (not `you`) because a main scheme's own ability has no single "revealing player" the way
 *   an encounter card does; `packages/engine/src/game-areas.test.ts`'s own reference test uses the same player.
 *
 * **Un-skipped this pass (docs/phase7-wave2.md §17.1, landed 2026-09-19):**
 * - `11013b.when-revealed` — "Each player searches the encounter deck, discard pile, and set-aside area for their
 *   nemesis minion and puts it into play engaged with them." The "search several zones as one pool" half (§10.1,
 *   `CardSelector { kind: "anyOf" }`, `anyOfCards` here) already had its worked example be this exact card; what was
 *   still missing was the *identification* half, now `TargetQuery.nemesisMinionOf?: PlayerRef` (§17.1) — "belongs to
 *   *that player's own* nemesis set", checked both by the card's own `(X's nemesis minion.)` parenthetical
 *   (`nemesisMinion: true`) and by encounter-set membership against that player's identity's own
 *   `nemesisEncounterSetId`. One `forEachPlayer`/`selectCards`/`putIntoPlay` triple, no per-player special-casing.
 *   "Puts it into play engaged with them" needs no separate `engage` effect: `putIntoPlay`'s own `controller`
 *   already engages a minion with that player (`zola.ts`'s Island of Dr. Zola setup uses the same shape). Kang
 *   insert, "Setup" (§2.3): "Kang's Wrath 4B searches for each player's nemesis minion."
 *
 * **Still a data gap (`card-data-pipeline`), not a primitive gap:**
 * - `11007b.when-revealed` and `11013b.when-revealed` each carry only one ability ref for text with two distinct
 *   clauses (the "When Revealed" sentence, scripted below for both, plus a "When Completed Abilities" (RRG 1.8
 *   p. 48) "If this stage is completed, the players lose the game" sentence with no ref of its own — the same
 *   data-shape gap Captured by Hydra (04107, `taskmaster.ts`) has for its "When Defeated" half).
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
  // Remove each player's obligation cards from the game. Shuffle the encounter deck.
  //
  // **Fixed this pass (found by testing 11021, kang-encounter-set.ts): `query("obligation")` — every card typed
  // "obligation" — is too broad now that the Kang/Temporal encounter set's own four obligations (11018–11021) are
  // scripted.** The original reading ("`includeIdentitySets` shuffles in exactly one seated player's own obligation
  // per copy and no others, so 'every obligation-type card in the deck' and 'each player's own obligation cards'
  // name the identical set") was written before that set existed and stopped being true the moment it landed: this
  // removed the Temporal obligations from the game at setup too, so `11021.when-revealed`'s own test (stacking it
  // onto the encounter deck) found it missing entirely. There is no `TargetQuery` field reading "the card this
  // identity's own `obligationCardId` names" (that field is setup-time-only, `packages/engine/src/setup.ts`,
  // `deck.ts` — not a live query), so the fix reads the *shape* of the distinction instead: every identity's own
  // obligation is untraited, and all four Temporal obligations carry the TEMPORAL trait (`packages/content/src/
  // data/toafk/cards.ts`), so `withoutTrait: TEMPORAL` names exactly "each player's obligation cards" without
  // naming any identity.
  "11007a.setup": setup(
    selectCards("obligations", { kind: "encounter", zones: ["deck"], filter: query("obligation", { withoutTrait: TEMPORAL }) }),
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

  // The Master of Time 2B — Forced Interrupt: when an acceleration token would be placed on another scheme, place
  // it here instead (docs/phase7-wave2.md §10.3: a constant redirect, read at placement). Players cannot join this
  // game area unless there are no other game areas remaining — no rule needed, the join procedure already only
  // offers separate areas as destinations (§10.4). When all the players have joined this game area, advance to
  // stage 4A.
  "11008b.the-master-of-time-forced-interrupt": constant({ rules: [{ kind: "accelerationTokenDestination", to: self }] }),
  "11008b.the-master-of-time-constant": stateCheck(not(gameAreasSplit), { kind: "advanceMainScheme", to: { stageNumber: 4 }, scheme: self }),

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

  // Kang's Wrath 4A — When Revealed: reveal Kang (III) and add him to the game area. Reveal each face down Kang's
  // Dominion under this stage (module docblock, §10.2). `firstPlayer`, not `you`: a main scheme's own ability has
  // no single "revealing player" context the way an encounter card does (`packages/engine/src/game-areas.test.ts`'s
  // own reference test uses the same player for the equivalent effect).
  "11013a.when-revealed": whenRevealed(
    selectCards("kang", encounterSetAside({ name: cardName("11006") })),
    addVillain(chosen("kang"), { reveal: true }),
    revealCard(tuckedUnderRef(centralMainScheme), firstPlayer),
  ),
  // Kang's Wrath 4B — When Revealed: each player searches the encounter deck, discard pile, and set-aside area for
  // their nemesis minion and puts it into play engaged with them (module docblock, §17.1). The "loses the game if
  // completed" half has no ability ref — module docblock.
  "11013b.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      selectCards(
        "nemesis",
        anyOfCards(
          encounterCards(["deck", "discard"], query("minion", { nemesisMinionOf: thatPlayer })),
          setAside(thatPlayer, query("minion", { nemesisMinionOf: thatPlayer })),
        ),
      ),
      putIntoPlay(chosen("nemesis"), thatPlayer),
    ),
  ),
});
