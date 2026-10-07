/**
 * Who may defend an enemy attack, across players (owner rulings 2026-10-06, docs/phase7-wave7.md §4.1).
 *
 * RRG 1.8 "Defend, Defense" (pp. 14-15) has two limits between players, and both are read here, from one record:
 *  - "Only one player at a time can defend against an enemy attack. While a player is defending, other players cannot
 *    defend against that same attack." A player is defending while a character they control is the attack's defender,
 *    an ally as much as a hero: "If a player defends against an enemy attack that targets a different player (either
 *    by defending with a character they control or by resolving a defense ability), the defending player becomes the
 *    new target of that attack." Resolving a defense ability is itself defending, so the bar covers a "(defense)"
 *    ability as well as being declared the defender.
 *  - "Once a player resolves a defense-labeled ability during an enemy attack, other players cannot resolve
 *    defense-labeled abilities for that same attack."
 *
 * Neither limits the player concerned: "The defending player may resolve any number of defense abilities during an
 * enemy attack", and "Defense-labeled abilities can be played during an attack by a player whose ally is defending
 * that attack. In that case, the player's identity does not become the defender."
 *
 * The record is the attack's own frames, so it ends with the attack: the defender on the attack procedure (or, before
 * the procedure starts and after it ends, on the attack's event frame), and `defenseLabeledBy` on the event frame.
 */

import type { EngineDeps } from "./abilities.js";
import type { PlayerId } from "./ids.js";
import { cardsInPlay, controllerOf, DEFENDER_SLOT } from "./select.js";
import type { StackFrame, TriggerCandidate } from "./stack.js";
import type { GameState } from "./state.js";

/** Why a player may not defend the attack in progress, by a "(defense)" ability or as the declared defender. */
export type DefenseBar =
  /** A character another player controls is defending this attack. */
  | "anotherPlayerDefending"
  /** Another player has resolved a "(defense)"-labeled ability during this attack. */
  | "anotherPlayerUsedDefense";

/** Written to be shown as it is, like `EngineError.message`. */
export const DEFENSE_BAR_MESSAGE: Readonly<Record<DefenseBar, string>> = {
  anotherPlayerDefending: "another player is defending this attack",
  anotherPlayerUsedDefense: "another player already used a defense card for this attack",
};

type EventFrame = Extract<StackFrame, { kind: "event" }>;

/** The innermost enemy attack on the stack: its event frame, from its initiation to its last response. */
export const currentEnemyAttackFrame = (state: GameState): EventFrame | null =>
  state.stack.find((f): f is EventFrame => f.kind === "event" && f.event.kind === "enemyAttack") ?? null;

/** The cross-player record of the enemy attack in progress, or null outside one. */
export interface DefenseClaim {
  /** The player whose character is defending the attack right now. */
  readonly defendingPlayerId: PlayerId | null;
  /** The first player to resolve a "(defense)"-labeled ability during the attack. */
  readonly labeledPlayerId: PlayerId | null;
}

export function defenseClaimOf(state: GameState): DefenseClaim | null {
  const attack = currentEnemyAttackFrame(state);
  if (!attack) return null;
  const procedure = state.stack.find((f) => f.kind === "enemyAttack" && f.eventFrameId === attack.frameId);
  // The procedure is the authority while it runs: a defending ally that left play is no longer its defender.
  const defender =
    procedure?.kind === "enemyAttack" ? procedure.defenderInstanceId : ((attack.slots[DEFENDER_SLOT] ?? [])[0] ?? null);
  const defending = defender !== null && cardsInPlay(state).includes(defender) ? controllerOf(state, defender) : null;
  return { defendingPlayerId: defending, labeledPlayerId: attack.defenseLabeledBy ?? null };
}

/**
 * The one predicate: why `playerId` may not resolve a "(defense)"-labeled ability, or have a character declared the
 * defender, for the enemy attack in progress. Null when they may, and outside an enemy attack.
 */
export function defenseBarFor(state: GameState, playerId: PlayerId | null): DefenseBar | null {
  if (playerId === null) return null;
  const claim = defenseClaimOf(state);
  if (!claim) return null;
  if (claim.defendingPlayerId !== null && claim.defendingPlayerId !== playerId) return "anotherPlayerDefending";
  if (claim.labeledPlayerId !== null && claim.labeledPlayerId !== playerId) return "anotherPlayerUsedDefense";
  return null;
}

/** Whether the candidate's ability is labeled "(defense)". */
export const isDefenseLabeled = (deps: EngineDeps, candidate: TriggerCandidate): boolean =>
  deps.abilities[candidate.abilityId]?.label?.includes("defense") === true;

/** `defenseBarFor` for a triggered ability about to be offered or initiated: only a "(defense)"-labeled one is barred. */
export const candidateDefenseBar = (
  state: GameState,
  deps: EngineDeps,
  candidate: TriggerCandidate,
): DefenseBar | null => (isDefenseLabeled(deps, candidate) ? defenseBarFor(state, candidate.controllerId) : null);

/**
 * The same for a player being asked in a timing window whose earlier answers are still queued. Players are asked in
 * player order and their picks resolve afterwards, so a "(defense)" ability an earlier player picked is not yet on
 * the record: it holds the attack's defense for that player, and later players are not offered theirs.
 */
export function windowDefenseBar(
  state: GameState,
  deps: EngineDeps,
  queue: readonly TriggerCandidate[],
  candidate: TriggerCandidate,
): DefenseBar | null {
  if (!isDefenseLabeled(deps, candidate)) return null;
  const recorded = defenseBarFor(state, candidate.controllerId);
  if (recorded !== null || candidate.controllerId === null || currentEnemyAttackFrame(state) === null) return recorded;
  const claimed = queue.find((queued) => isDefenseLabeled(deps, queued) && queued.controllerId !== null);
  return claimed && claimed.controllerId !== candidate.controllerId ? "anotherPlayerUsedDefense" : null;
}
