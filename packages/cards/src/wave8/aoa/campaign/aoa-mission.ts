import type {
  AbilityDefinition,
  AbilityRegistry,
  EffectSpec,
  EventPattern,
  PlayerRef,
  TargetQuery,
  TargetRef,
} from "@mc/engine";
import {
  addCounters,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  countersOn,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discardFromHand,
  each,
  eachPlayer,
  encounterSetAside,
  endGame,
  eventPlayer,
  find,
  findCard,
  firstPlayer,
  flipCard,
  forcedResponse,
  forEachPlayer,
  grantOwnedCards,
  ifThen,
  moveCards,
  on,
  oneCopyOf,
  perHero,
  placeThreat,
  playerOrElse,
  query,
  reaching,
  revealCard,
  self,
  shuffleDeck,
  thatPlayer,
  theMainScheme,
  valueAtLeast,
  whenDefeated,
  zone,
} from "../../../dsl/index.js";
import {
  ALLY_AT_THE_MISSION,
  AT_THE_MISSION,
  MINION_AT_THE_MISSION,
  MISSION_AREA,
  MISSION_ATTEMPT,
  MISSION_TEAM,
} from "./mission-rules.js";

/**
 * Campaign-only encounter set `aoa_mission` (campaign mode only; docs/phase7-wave8.md §1.24, §2.13, §3.37, §3.39,
 * §3.40, §4.1 Q18 to Q20). The five missions, a face (the [MISSION] side scheme) and b face (the [FINISHED] side).
 *
 * **The a face**, the same two lines on all five.
 *
 * "Forced Response: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally
 *   at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over."
 *   It answers the moment Mission Team's attempt raises (`MISSION_ATTEMPT`), whoever made the attempt: a mission has
 *   no controller. An attempt that defeated the mission in its step 5 finds this face gone and places no counter.
 *   Removing Mission Team from the game is not a discard (§3.35).
 *
 * "When Defeated: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card
 *   over." The upgrades first, then the allies, so an upgrade is shuffled into its deck and not discarded as its host
 *   leaves play (RRG 1.8 "Attachment", p. 8). Before it flips, the card takes one `defeated` counter: the [FINISHED]
 *   face is reached for one of two reasons and reads the counter to know which (§3.40: a flip between two side schemes
 *   keeps the card's tokens, RRG 1.8 "Flip", p. 20). The flip keeps the card in the mission area.
 *
 * **The b face**: "Forced Response: After you flip to this side, remove each card in the mission area from the game
 * and do the following:" then one bullet for a mission that was not defeated and one for a mission that was. Cards
 * attached to a card there go first (the facedown cards on Abyss are removed with him, §2.13), then every other card
 * there. The [FINISHED] face is itself a card in the mission area: it goes last, once its bullet has resolved (§4.1
 * Q20 = A). "You" is the player whose effect flipped the card, else the first player.
 *
 * Each player's part of a bullet resolves in player order (RRG 1.8 "Each Player", p. 17). A search finds a card when
 * one is there (RRG 1.8 "Search", p. 39) and the deck is shuffled after.
 *
 * What the campaign must have set aside for the bullets: the four copies of Desperate Measures (45176) for Liberate
 * the Seattle Core, and the campaign allies (45172 to 45175) for Find Lost Mutants. North American Sea Wall (45177) is
 * found wherever it is.
 *
 * Cards (10):
 * - 45166a Liberate the Seattle Core (side_scheme)
 * - 45166b Liberate the Seattle Core (side_scheme)
 * - 45167a Evacuate Survivors (side_scheme)
 * - 45167b Evacuate Survivors (side_scheme)
 * - 45168a Sabotage the Sea Wall (side_scheme)
 * - 45168b Sabotage the Sea Wall (side_scheme)
 * - 45169a Find Lost Mutants (side_scheme)
 * - 45169b Find Lost Mutants (side_scheme)
 * - 45170a Protect the Professor (side_scheme)
 * - 45170b Protect the Professor (side_scheme)
 */
const you: PlayerRef = playerOrElse(eventPlayer, firstPlayer);
const ATTEMPT_COUNTER = "attempt";
/** Set on the a face by its When Defeated, read by the b face: "if the mission was defeated". */
const DEFEATED_MARK = "defeated";
const missionTeam: TargetRef = each(MISSION_TEAM);
/** "After you flip to this side" (a card of two faces: only a flip reaches the back). */
const flipsToThisSide: EventPattern = { on: "cardFlipped", selfIs: "target" };

// Forced Response: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at
// the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.
const afterAnAttempt = (): AbilityDefinition =>
  reaching(
    MISSION_AREA,
    forcedResponse(
      on.moment(MISSION_ATTEMPT, { anyPlayer: true }),
      addCounters(ATTEMPT_COUNTER, 1),
      dealDamage(1, each(ALLY_AT_THE_MISSION)),
      ifThen(valueAtLeast(countersOn(self, ATTEMPT_COUNTER), 4), [
        moveCards(cards(missionTeam), "removedFromGame"),
        flipCard(self),
      ]),
    ),
  );

// When Defeated: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.
const defeated = (): AbilityDefinition =>
  reaching(
    MISSION_AREA,
    whenDefeated(
      addCounters(DEFEATED_MARK, 1),
      moveCards(cards(each(query("upgrade", AT_THE_MISSION))), "deckShuffle"),
      moveCards(cards(each(ALLY_AT_THE_MISSION)), "deckShuffle"),
      flipCard(missionTeam),
      flipCard(self),
    ),
  );

const everythingElseThere: TargetQuery = { ...AT_THE_MISSION, self: false };
/**
 * Forced Response: After you flip to this side, remove each card in the mission area from the game and do the
 * following: • If the mission was not defeated, … • If the mission was defeated, …
 */
const finished = (bullets: {
  readonly notDefeated: readonly EffectSpec[];
  readonly defeated: readonly EffectSpec[];
}): AbilityDefinition =>
  reaching(
    MISSION_AREA,
    forcedResponse(
      flipsToThisSide,
      // What is attached to a card there, a facedown card included (out of play, so no query over cards in play
      // finds it), then the cards themselves.
      moveCards(cards({ kind: "attachmentsOf", of: each(MINION_AT_THE_MISSION) }), "removedFromGame"),
      moveCards(cards({ kind: "attachmentsOf", of: each(ALLY_AT_THE_MISSION) }), "removedFromGame"),
      moveCards(cards(each(everythingElseThere)), "removedFromGame"),
      ifThen(valueAtLeast(countersOn(self, DEFEATED_MARK), 1), [...bullets.defeated], [...bullets.notDefeated]),
      moveCards(cards(self), "removedFromGame"),
    ),
  );

/** "Each player searches their deck and discard pile for [a card] and adds it to their hand." */
const eachPlayerSearches = (filter?: TargetQuery): EffectSpec =>
  forEachPlayer(
    eachPlayer,
    chooseCards("found", zone(["deck", "discard"], thatPlayer, filter ? { filter } : {}), {
      min: 1,
      max: 1,
      chooser: thatPlayer,
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(thatPlayer),
  );

const SEA_WALL = query("sideScheme", { name: "North American Sea Wall" });
const CAMPAIGN_ALLY: TargetQuery = {
  categories: ["ally"],
  anyOf: [{ name: "Destiny" }, { name: "Blink" }, { name: "Morph" }, { name: "X-Man" }],
};

export const AOA_MISSION: AbilityRegistry = defineAbilities({
  "45166a.liberate-the-seattle-core-forced-response": afterAnAttempt(),
  "45166a.when-defeated": defeated(),
  // • If the mission was not defeated, place 2[per_hero] threat on the main scheme.
  // • If the mission was defeated, each player adds 1 copy of the Desperate Measures upgrade to their hand.
  "45166b.liberate-the-seattle-core-forced-response": finished({
    notDefeated: [placeThreat(perHero(2), theMainScheme)],
    defeated: [
      forEachPlayer(
        eachPlayer,
        grantOwnedCards(oneCopyOf(encounterSetAside({ name: "Desperate Measures" })), "hand", thatPlayer),
      ),
    ],
  }),

  "45167a.evacuate-survivors-forced-response": afterAnAttempt(),
  "45167a.when-defeated": defeated(),
  // • If the mission was not defeated, deal each player a facedown encounter card.
  // • If the mission was defeated, each player searches their deck and discard pile for 1 card and adds it to their
  //   hand.
  "45167b.evacuate-survivors-forced-response": finished({
    notDefeated: [forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer))],
    defeated: [eachPlayerSearches()],
  }),

  "45168a.sabotage-the-sea-wall-forced-response": afterAnAttempt(),
  "45168a.when-defeated": defeated(),
  // • If the mission was not defeated, find North American Sea Wall and reveal it. (Shuffle.)
  // • If the mission was defeated, find North American Sea Wall, remove it from the game, and each player deals 3
  //   damage to an enemy. It is gone first, in printed order, so its "The villain cannot take damage" no longer holds.
  "45168b.sabotage-the-sea-wall-forced-response": finished({
    notDefeated: [revealCard(find(SEA_WALL), you)],
    defeated: [
      findCard(SEA_WALL, "removedFromGame"),
      forEachPlayer(
        eachPlayer,
        chooseTarget("enemy", query("enemy"), { chooser: thatPlayer }),
        dealDamage(3, chosen("enemy")),
      ),
    ],
  }),

  "45169a.find-lost-mutants-forced-response": afterAnAttempt(),
  "45169a.when-defeated": defeated(),
  // • If the mission was not defeated, each player discards 1 card from their hand.
  // • If the mission was defeated, each player adds one set-aside campaign ally to their hand.
  "45169b.find-lost-mutants-forced-response": finished({
    notDefeated: [forEachPlayer(eachPlayer, discardFromHand(1, thatPlayer))],
    defeated: [
      forEachPlayer(
        eachPlayer,
        chooseCards("ally", encounterSetAside(CAMPAIGN_ALLY), { min: 1, max: 1, chooser: thatPlayer }),
        grantOwnedCards(cards(chosen("ally")), "hand", thatPlayer),
      ),
    ],
  }),

  "45170a.protect-the-professor-forced-response": afterAnAttempt(),
  "45170a.when-defeated": defeated(),
  // • If the mission was not defeated, the players lose the game.
  // • If the mission was defeated, each player searches their deck and discard pile for an ally and adds it to their
  //   hand.
  "45170b.protect-the-professor-forced-response": finished({
    notDefeated: [endGame("loss")],
    defeated: [eachPlayerSearches(query("ally"))],
  }),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. Empty: all ten faces are scripted. */
export const AOA_MISSION_SKIPPED: Readonly<Record<string, string>> = {};
