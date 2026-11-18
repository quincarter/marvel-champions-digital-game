/**
 * RRG 1.8 "Player Elimination" (p. 34): "If a player is eliminated in the middle of an attack, that attack ends." An
 * attack of the eliminated identity on the stack at the elimination is marked (`Frame<"event">.attackerEliminated`,
 * `eliminatePlayer` in `defeat.ts`), and the mark ends it wherever it stands:
 *
 * - **Before its damage step**: `applyPlayerAttack` deals nothing (`resolve/event.ts`).
 * - **At its response step**, reached from its own apply step or, for an "(attack)" ability's attack waiting beneath the
 *   ability (`attack-ability.ts`), once the ability has finished: `endEliminatedAttack`. The attack is logged as ended
 *   (`playerAttackEnded`) and none of its remaining results resolve: no `characterAttacked` for the enemies a waiting
 *   attack attacked (so no retaliate), no "resolved" line and no response window for the attack itself ("after … attacks
 *   [and defeats]"). Damage it had already dealt stays dealt, so the conditions of that damage handed to the attack's
 *   window (`joinedResponses`, "after … takes damage") still open; its "at the end of this attack" effects still
 *   resolve, as for an attack that ended early (RRG 1.8 "Delayed Effect", p. 16).
 * - **A `characterAttacked` of the attack not yet applied** (`partOfEliminatedAttack`): a basic attack pushes it with
 *   its damage, and an elimination while that damage resolves leaves it on the stack. It is taken off unapplied.
 *
 * A new attack begun after the elimination is not marked and resolves (owner call, #816; `attackOfEliminatedResolves`).
 * A mark set during the attack's own response window (the attack has already resolved; its step 8 responses are being
 * used) changes nothing.
 */

import { type Ctx, emit, findFrame, setFrame } from "../ctx.js";
import type { Frame } from "./frames.js";
import type { GameState } from "../state.js";

/** An attack frame its player's elimination ended (`attackerEliminated`). */
export function endedByElimination(frame: Frame<"event">): boolean {
  return frame.event.kind === "attack" && frame.attackerEliminated === true;
}

/**
 * Ends an attack frame at its response step (see the file header). Leaves it at `done`, holding only the damage
 * conditions it was handed, so the `done` stage opens their window, runs its end-of-attack effects and pops it.
 */
export function endEliminatedAttack(ctx: Ctx, frame: Frame<"event">): void {
  if (frame.event.kind !== "attack") return;
  const target = frame.event.targetInstanceId;
  if (target !== null) {
    emit(ctx, {
      type: "playerAttackEnded",
      attackerInstanceId: frame.event.attackerInstanceId,
      targetInstanceId: target,
      reason: "attackerLeftPlay",
    });
  }
  const { attacked: _attacked, attackWaiting: _waiting, joinedResponses = [], ...rest } = frame;
  const kept = joinedResponses.filter((event) => event.kind !== "characterAttacked");
  setFrame(ctx, { ...rest, stage: "done", ...(kept.length > 0 ? { joinedResponses: kept } : {}) });
}

/** A `characterAttacked` waiting to join the window of an attack its player's elimination ended. */
export function partOfEliminatedAttack(state: GameState, frame: Frame<"event">): boolean {
  if (frame.event.kind !== "characterAttacked" || frame.responsesWith === undefined) return false;
  if (frame.stage !== "interrupts" && frame.stage !== "apply") return false;
  const attack = findFrame(state, frame.responsesWith);
  return attack?.kind === "event" && endedByElimination(attack);
}
