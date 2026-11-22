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
import { firstPlayerOfCard, firstPlayerOfPlayersSide } from "../team-phases.js";

/**
 * Whose side of the table a decision is made for: the player resolving the card (a reveal's player), else the card
 * itself. With two teams each side has its own first player (MC56 p. 16), so "the first player" of an encounter card's
 * choice is the first player of the team it is resolved for, also when that team is not the active one (Q11 A per
 * owner decision 2026-11-20). With one team, the table's first player.
 */
export interface DecisionSide {
  readonly playerId?: PlayerId | null;
  readonly instanceId?: InstanceId | null;
}

const firstPlayerFor = (state: GameState, side: DecisionSide | undefined): PlayerId => {
  if (side?.playerId) return firstPlayerOfPlayersSide(state, side.playerId);
  if (side?.instanceId) return firstPlayerOfCard(state, side.instanceId);
  return state.firstPlayerId;
};

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

/** Whether the card is of an encounter-side type, wherever it is and whoever controls it (a revealed obligation, say). */
export function isEncounterCardType(state: GameState, id: InstanceId | null): boolean {
  const card = id ? cardOf(state, id) : undefined;
  return card !== undefined && ENCOUNTER_SIDE_TYPES.has(card.type);
}

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
export const encounterTargetSelector = (state: GameState, side?: DecisionSide): PlayerId => firstPlayerFor(state, side);

/**
 * RRG "First Player": the first player orders effects that would resolve simultaneously. Without a side, the active
 * team's first player (simultaneous triggers across both areas, N2 per owner decision 2026-11-20).
 */
export const simultaneousOrderer = (state: GameState, side?: DecisionSide): PlayerId => firstPlayerFor(state, side);

/**
 * The authority of a choice an effect asks of `chooser`. Scripts write
 * `chooser: firstPlayer` on an encounter card exactly where the card targets
 * without saying "choose"; a "choose" on an encounter card is the resolving
 * player's own decision (RRG "Choose"). `chooser: enemyTeamDecider` is a choice the card gives to "the enemy team"
 * (MC56 p. 6), on a card of either side.
 */
export function effectChoiceAuthority(
  state: GameState,
  sourceId: InstanceId | null,
  chooser: PlayerRef,
): DecisionAuthority {
  if (chooser.kind === "enemyTeamDecider") return "enemyTeam";
  // `firstPlayer` with `of: "enemy"` names the other team's token holder, who is not the encounter card's targeting
  // first player (RRG 1.8 "First Player", p. 19): their pick is their own.
  return chooser.kind === "firstPlayer" && chooser.of !== "enemy" && isEncounterSide(state, sourceId)
    ? "firstPlayerTargets"
    : "player";
}
