import { trait } from "@mc/content";
import type { EffectSpec, Predicate, RuleSpec, ScenarioSetupInstruction, TargetQuery, TargetRef } from "@mc/engine";
import {
  cannotEnterPlay,
  chooseCards,
  chosen,
  countOf,
  countTowardStartingHand,
  createScenarioPlayArea,
  dealPoolOneAtATime,
  each,
  eachPlayer,
  encounterSetAside,
  exists,
  firstPlayer,
  forEachPlayer,
  inScenarioPlayArea,
  moveCards,
  otherFaceOf,
  pairCards,
  putIntoPlay,
  query,
  raiseMoment,
  refCount,
  removeThreat,
  shuffleDeck,
  thatPlayer,
  topOfDeck,
  totalStatOf,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * The mission area of the Age of Apocalypse campaign (MC45 pp. 5–6; docs/phase7-wave8.md §1.29, §2.13, §3.33, §3.34).
 *
 * The double-sided Mission Rules card has no card record and is never an instance in a game (§1.29): its bullets are
 * rules of the mission area, in force "while a [MISSION] side scheme is in play". The five missions' a faces print no
 * constant for them, so they are scenario rules (`GameSetupConfig.scenarioRuleSpecs`), each conditioned on the
 * mission: the campaign's game builder passes `MISSION_RULES`, and `missionSetup` is the campaign instruction that
 * creates the area and puts the mission and its Overseer there. The engine names none of it.
 */
export const MISSION_AREA = "mission";
/** `putIntoPlay(card, you, { into: INTO_THE_MISSION })`: "add [this card] to the mission area". */
export const INTO_THE_MISSION = { scenarioPlayArea: MISSION_AREA } as const;
export const MISSION = trait("MISSION");

/** "… at the mission", "… in the mission area": the words that refer to the area. Spread into a query. */
export const AT_THE_MISSION = inScenarioPlayArea(MISSION_AREA);
/** "The [MISSION] side scheme": the a face only (the b face has the FINISHED trait). */
export const THE_MISSION: TargetQuery = query("sideScheme", { trait: MISSION, ...AT_THE_MISSION });
export const theMission: TargetRef = each(THE_MISSION);
/** "While a [MISSION] side scheme is in play" (MC45 p. 5). */
export const missionInPlay: Predicate = exists(THE_MISSION);
export const ALLY_AT_THE_MISSION: TargetQuery = query("ally", AT_THE_MISSION);
export const MINION_AT_THE_MISSION: TargetQuery = query("minion", AT_THE_MISSION);
/** Mission Team (45171a/b), on either face: the card whose Action makes a mission attempt. */
export const MISSION_TEAM: TargetQuery = query("support", { name: "Mission Team" });
/** The moment "After you resolve a mission attempt" answers (`raiseMoment`, section 3.39). */
export const MISSION_ATTEMPT = "missionAttempt";
/** The slot of the cards an attempt discarded from the top of the deck (step 1). */
const DISCARDED = "attempt";
/** The pairing of step 2: `pairing.matched` is the allies that participate. */
const PAIRING = "pairing";
const participants = chosen(`${PAIRING}.matched`);

/**
 * "When a player makes a mission attempt, they resolve the following five steps in order" (MC45 p. 6; sections 2.13,
 * 3.36 to 3.39). A script, used by Mission Team's Action: the engine knows no "mission".
 *
 * 1. "Discard X cards from the top of their deck, where X is the number of allies at the mission." A deck that runs out
 *    resets and "no further cards are discarded from the newly shuffled deck" (RRG 1.8 "Player Deck", p. 33). Each
 *    discard is announced before step 2: the Overseer's Mission Response (forced, first; RRG 1.8 "Forced", p. 20), then
 *    a discarded card's own Response. A card a response took away is no longer in the slot (ruling April 30, 2026 –
 *    Ruling 4 (1): "it does not count for the mission attempt and no replacement card is drawn").
 * 2. "Assign each of the discarded cards to a different ally at the mission." An ally whose card shares a resource icon
 *    with it participates, a [wild] on either side matching anything. The cards stay in the discard pile.
 * 3. and 4. A pool of the participants' total ATK, dealt to the enemies at the mission one at a time, each settled
 *    before the next; what nobody can take is lost. Not an attack.
 * 5. "Remove X threat from the [MISSION] side scheme, where X is the total THW of all participating allies." Not a
 *    thwart (RRG 1.8 "Thwart", p. 44): nothing exhausts and no ally takes consequential damage.
 *
 * Then the moment the mission's own Forced Response answers. It is raised whatever the steps did: an attempt with no
 * ally at the mission discards nothing and still counts. A mission step 5 defeated has flipped by then, so nothing
 * answers.
 */
export const missionAttempt = (): readonly EffectSpec[] => [
  moveCards(topOfDeck(countOf(ALLY_AT_THE_MISSION), you), "discard", DISCARDED),
  pairCards(chosen(DISCARDED), ALLY_AT_THE_MISSION, PAIRING),
  dealPoolOneAtATime(totalStatOf(participants, "atk"), MINION_AT_THE_MISSION),
  removeThreat(totalStatOf(participants, "thw"), theMission),
  raiseMoment(MISSION_ATTEMPT, you),
];

/**
 * The Mission Rules card's side A, bullet by bullet, as far as the engine can state them today:
 *
 * 1. "Players cannot thwart the [MISSION] side scheme." A basic thwart never lists a scheme in the area, and a
 *    thwart-labeled ability's query does not reach into a closed area (§3.33): nothing to add.
 * 2. "Cards in the mission area are in play but under no player's control. They cannot be affected by card abilities
 *    unless the ability refers to the mission area." The area itself, created closed (`missionSetup`).
 * 3. "When a player plays an ally, they must choose …": `playDestination` (§3.34), while the mission is in play.
 * 4. "Treat the printed text box of each ally at the mission as if it were blank, except for [TRAITS]." Traits are
 *    not text box (RRG 1.8 "Traits", p. 45), so `blankTextBox` keeps them with no exception to state.
 * 5. "Upgrades can be attached to allies at the mission.": the same rule's `attachments`. What an upgrade then does
 *    there is the closed area's question (§4.1 Q19 = B).
 * 6. "The [MISSION] side scheme cannot be defeated while there are any minions in the mission area."
 */
export const MISSION_RULES: readonly RuleSpec[] = [
  {
    kind: "playDestination",
    cards: query("ally"),
    area: MISSION_AREA,
    attachments: query("upgrade"),
    while: missionInPlay,
  },
  { kind: "blankTextBox", target: ALLY_AT_THE_MISSION },
  { kind: "notDefeatedWithoutThreat", target: THE_MISSION, while: exists(MINION_AT_THE_MISSION) },
];

/**
 * Campaign setup's mission and Overseer (MC45 p. 5; §2.12 steps 3 and 4), as one instruction the campaign resolves in
 * the window after scenario setup: the area is created, the drawn mission enters play there with 5[per_hero] threat,
 * and the drawn Overseer is put into play there, engaged with nobody. `missionTeam` (§2.12 step 5): "The first player
 * takes control of the Mission Team (171A) support card, [MISSION] side faceup", ready, in their play area. Every
 * card starts set aside.
 */
export const missionSetup = (
  mission: TargetRef,
  overseer?: TargetRef,
  missionTeam?: TargetRef,
): readonly EffectSpec[] => [
  createScenarioPlayArea(MISSION_AREA),
  putIntoPlay(mission, you, { into: INTO_THE_MISSION }),
  ...(overseer ? [putIntoPlay(overseer, you, { into: INTO_THE_MISSION })] : []),
  ...(missionTeam ? [putIntoPlay(missionTeam, firstPlayer)] : []),
];

export const missionSetupInstruction = (
  mission: TargetRef,
  overseer?: TargetRef,
  missionTeam?: TargetRef,
): ScenarioSetupInstruction => ({
  id: "aoa.mission-setup",
  text: "Randomly select one of the available [MISSION] side schemes and reveal it. Put a random Overseer minion into play in the mission area. The first player takes control of the Mission Team (171A) support card, [MISSION] side faceup.",
  citation: "MC45 p. 5",
  effects: missionSetup(mission, overseer, missionTeam),
});

/** The slot of the ally a player found in the search below. */
const FOUND_ALLY = "foundAlly";

/**
 * The fifth bullet of every scenario's Campaign Instructions (MC45 p. 20; docs/phase7-wave8.md §3.44): "Each player
 * searches their deck for an ally and adds it to their hand. (This card counts towards your hand size.)" In player
 * order, each player looks at their whole deck, takes an ally and shuffles (RRG 1.8 "Search", p. 39); the found card
 * then counts toward the starting hand, so that player's draw of Appendix II step 14 is one card smaller
 * (`countTowardStartingHand`). A player whose deck holds no ally finds nothing and draws in full. The mulligan is the
 * ordinary one. Resolved before the starting hands are drawn (a campaign instruction of the window after scenario
 * setup); cards the mission's Setup cell shuffled into the deck are in it already.
 *
 * A player whose deck holds an ally takes one: the RRG's search has no "may" ("If the player finds a card that
 * satisfies the criteria of the search, the player adds that card").
 *
 * Standard campaign only. The expert sentence ("the ally you choose during Setup must share a trait with your hero")
 * is not built: `sharesTraitWith(identityOf(...))` reads the face that is up, and at setup that is the alter-ego.
 */
export const allySearch = (): readonly EffectSpec[] => [
  forEachPlayer(
    eachPlayer,
    chooseCards(FOUND_ALLY, zone("deck", thatPlayer, { filter: query("ally") }), {
      min: 1,
      max: 1,
      chooser: thatPlayer,
    }),
    moveCards({ kind: "ref", ref: chosen(FOUND_ALLY) }, "hand"),
    shuffleDeck(thatPlayer),
    countTowardStartingHand(thatPlayer, refCount(chosen(FOUND_ALLY))),
  ),
];

export const allySearchInstruction = (): ScenarioSetupInstruction => ({
  id: "aoa.ally-search",
  text: "Each player searches their deck for an ally and adds it to their hand. (This card counts towards your hand size.)",
  citation: "MC45 p. 20",
  effects: allySearch(),
});

/**
 * Scenario 5's own Campaign Instruction (MC45 p. 20; docs/phase7-wave8.md §3.43): "Professor X cannot enter play
 * during this game." A rule of that one game, passed with `MISSION_RULES` as its scenario rules. By title, so both
 * printings are covered; the card may still be in a deck, be drawn, be discarded and pay for other cards.
 */
export const PROFESSOR_X_CANNOT_ENTER_PLAY: RuleSpec = cannotEnterPlay(query("ally", { name: "Professor X" }));

/**
 * Scenario 3 in a campaign (MC45 p. 14; docs/phase7-wave8.md §3.46, §4.1 Q21 = A): "The [PRELATE] minions (179-183)
 * are found on the reverse sides of the [OVERSEER] minions", so the Prelate that is the other face of the Overseer
 * drawn for this game is not available as a Prelate: it is removed from the game before the 1A Setup reveals one
 * (a campaign instruction of the window before scenario setup), which leaves four set aside. `overseer` names the
 * Overseer drawn, wherever it is (it is still set aside then). A struck Overseer's Prelate is untouched: only the
 * one drawn for this game is named (ruling April 30, 2026, Ruling 4 (2)).
 */
export const removeOverseersPrelate = (overseer: TargetRef): readonly EffectSpec[] => [
  moveCards(encounterSetAside(query("minion", otherFaceOf(overseer))), "removedFromGame"),
];
