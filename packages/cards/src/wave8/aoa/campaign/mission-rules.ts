import { trait } from "@mc/content";
import type { EffectSpec, Predicate, RuleSpec, ScenarioSetupInstruction, TargetQuery, TargetRef } from "@mc/engine";
import {
  createScenarioPlayArea,
  each,
  exists,
  inScenarioPlayArea,
  putIntoPlay,
  query,
  you,
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
 * and the drawn Overseer is put into play there, engaged with nobody. Both cards start set aside.
 */
export const missionSetup = (mission: TargetRef, overseer?: TargetRef): readonly EffectSpec[] => [
  createScenarioPlayArea(MISSION_AREA),
  putIntoPlay(mission, you, { into: INTO_THE_MISSION }),
  ...(overseer ? [putIntoPlay(overseer, you, { into: INTO_THE_MISSION })] : []),
];

export const missionSetupInstruction = (mission: TargetRef, overseer?: TargetRef): ScenarioSetupInstruction => ({
  id: "aoa.mission-setup",
  text: "Randomly select one of the available [MISSION] side schemes and reveal it. Put a random Overseer minion into play in the mission area.",
  citation: "MC45 p. 5",
  effects: missionSetup(mission, overseer),
});
