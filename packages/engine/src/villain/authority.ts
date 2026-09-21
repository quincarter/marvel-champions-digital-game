/**
 * Who decides on the encounter side's behalf. Marvel Champions has no villain
 * player: the villain's procedure is forced, and each decision it leaves open
 * belongs to a player by rule. This module is the one place that mapping lives.
 */

import type { DecisionAuthority } from "../choices.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardOf } from "../query.js";
import { controllerOf } from "../select.js";
import type { PlayerRef } from "../spec.js";
import type { GameState } from "../state.js";

const ENCOUNTER_SIDE_TYPES: ReadonlySet<string> = new Set([
  "villain",
  "main_scheme",
  "side_scheme",
  "minion",
  "treachery",
  "attachment",
  "environment",
  "obligation",
]);

/** A villain, scheme or encounter card that no player controls. */
export function isEncounterSide(state: GameState, id: InstanceId | null): boolean {
  if (!id) return false;
  const card = cardOf(state, id);
  return card !== undefined && ENCOUNTER_SIDE_TYPES.has(card.type) && controllerOf(state, id) === null;
}

/**
 * RRG "First Player": when an encounter card targets a player or card and more
 * than one is eligible, the first player picks among them.
 */
export const encounterTargetSelector = (state: GameState): PlayerId => state.firstPlayerId;

/** RRG "First Player": the first player orders effects that would resolve simultaneously. */
export const simultaneousOrderer = (state: GameState): PlayerId => state.firstPlayerId;

/**
 * The authority of a choice an effect asks of `chooser`. Scripts write
 * `chooser: firstPlayer` on an encounter card exactly where the card targets
 * without saying "choose"; a "choose" on an encounter card is the resolving
 * player's own decision (RRG "Choose").
 */
export function effectChoiceAuthority(
  state: GameState,
  sourceId: InstanceId | null,
  chooser: PlayerRef,
): DecisionAuthority {
  return chooser.kind === "firstPlayer" && isEncounterSide(state, sourceId) ? "firstPlayerTargets" : "player";
}
