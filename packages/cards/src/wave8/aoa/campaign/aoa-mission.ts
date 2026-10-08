import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `aoa_mission` (campaign mode only; docs/phase7-wave8.md §1.24, §2.13, §3.37, §3.39,
 * §3.40, §4.1 Q18 to Q20). The five missions, a face (the [MISSION] side scheme) and b face (the [FINISHED] side).
 *
 * **Nothing here is registered.** The a faces are the same two lines (an attempt counter and 1 damage to each ally at
 * the mission after "a mission attempt" resolves; shuffle each player card at the mission into its owner's deck and
 * flip Mission Team when defeated). The b faces remove each card in the mission area from the game and branch on
 * whether the mission was defeated.
 *
 * The mission area, its closed filter and the ally's play into it have landed (tasks 31 to 33, `mission-rules.ts`):
 * a mission is put into the area by campaign setup, is no target for a thwart, and stays undefeated while a minion is
 * there. What its own text still waits on: the mission attempt (Mission Team's, tasks 37 and 38), Mission Team itself
 * (task 34 on), and the flip. A side scheme that flips to its other face is placed in the villain's area today, so
 * the [FINISHED] face would leave the mission area it is about to clear; section 3.40 has to keep it there. A When
 * Defeated registered alone would shuffle the allies away and then flip into that gap, so the faces land together.
 * See `AOA_MISSION_SKIPPED`.
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
export const AOA_MISSION: AbilityRegistry = defineAbilities({});

const FLIP =
  "a flip to the other face inside the mission area (section 3.40: `flipToOtherFace` puts a side scheme's new face in the villain's area today)";
const ATTEMPT = `'After you resolve a mission attempt' is the moment Mission Team's attempt raises (tasks 37 and 38); the fourth counter removes Mission Team (task 34) and needs ${FLIP}`;
const DEFEATED = `'flip Mission Team and this card over' needs Mission Team's faces (tasks 34 to 38) and ${FLIP}; the shuffle of each player card at the mission is expressible now`;
const FLIPPED = `this face is only reached by ${FLIP}, from a mission that was attempted (tasks 37 and 38); the branch reads the mission-defeated marker its a face sets (section 3.40, Q20)`;

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. */
export const AOA_MISSION_SKIPPED: Readonly<Record<string, string>> = {
  "45166a.liberate-the-seattle-core-forced-response": ATTEMPT,
  "45166a.when-defeated": DEFEATED,
  "45166b.liberate-the-seattle-core-forced-response": `${FLIPPED}; then 2[per_hero] threat on the main scheme, or each player adds Desperate Measures to their hand (set aside by the campaign)`,
  "45167a.evacuate-survivors-forced-response": ATTEMPT,
  "45167a.when-defeated": DEFEATED,
  "45167b.evacuate-survivors-forced-response": `${FLIPPED}; then a facedown encounter card each, or each player searches their deck and discard pile for a card`,
  "45168a.sabotage-the-sea-wall-forced-response": ATTEMPT,
  "45168a.when-defeated": DEFEATED,
  "45168b.sabotage-the-sea-wall-forced-response": `${FLIPPED}; then find North American Sea Wall and reveal it, or remove it from the game and each player deals 3 damage to an enemy`,
  "45169a.find-lost-mutants-forced-response": ATTEMPT,
  "45169a.when-defeated": DEFEATED,
  "45169b.find-lost-mutants-forced-response": `${FLIPPED}; then each player discards a card, or adds a set-aside campaign ally to their hand`,
  "45170a.protect-the-professor-forced-response": ATTEMPT,
  "45170a.when-defeated": DEFEATED,
  "45170b.protect-the-professor-forced-response": `${FLIPPED}; then the players lose the game, or each player searches their deck and discard pile for an ally`,
};
