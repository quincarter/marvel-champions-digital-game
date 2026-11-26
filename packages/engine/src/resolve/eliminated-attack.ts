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

import { type Ctx, emit, findFrame, popFrame, setFrame } from "../ctx.js";
import type { Frame } from "./frames.js";
import type { GameState } from "../state.js";
import type { StackFrame } from "../stack.js";

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

/**
 * The enemy attacks underway as a player is eliminated, each marked to end (RRG 1.8 "Player Elimination", p. 34: "If a
 * player is eliminated in the middle of an attack, that attack ends"). Any player's elimination, not only the attack's
 * target's or the attacked player's (rules-expert, #1012); the ability that eliminated them still resolves in full.
 *
 * - **An `enemyAttack` event in its "when … attacks" interrupt window**, its procedure not yet pushed: the event frame
 *   (at its `apply` stage, which it reaches as that window opens) is marked, and the procedure ends at its give-boost
 *   step (`endedByTargetElimination`, `resolve/enemy-activation.ts`). An attack still queued behind it (stage
 *   `interrupts`, not begun: a second enemy's attack pushed in the same batch) is not in the middle and resolves.
 * - **Its procedure before the damage step has dealt anything** (giving or turning boost cards, declaring a defender,
 *   the damage step's own interrupt window): the procedure is marked and ends at the step it has reached.
 * - **Its damage queued but not yet dealt** (the procedure has finished and pushed the damage, which is in its own
 *   "when … would take damage" interrupt window): the attack's `dealDamage` and `characterAttacked` events still
 *   waiting are marked, and are taken off unapplied (`endedEnemyAttackPart`): no damage, no retaliate.
 *
 * Damage the attack has already dealt stays dealt, and an attack whose damage has been dealt is left alone (its
 * `characterAttacked` and response window follow as before). Not marked: an enemy's attack on another enemy
 * (`versusEnemy`, Headpool; engine reading, the boost player is not attacked), and the indirect or evenly divided damage
 * an attack hands to an effect to assign (`dealIndirectDamage`, `divideDamageEvenly`; engine limitation, not tracked).
 */
export function markEnemyAttacksUnderway(ctx: Ctx): void {
  const stack = ctx.state.stack;
  const queuedFor = new Set<string>();
  for (const frame of stack) {
    if (frame.kind !== "enemyAttack" || frame.versusEnemy || frame.stage !== "done" || frame.eventFrameId === null) {
      continue;
    }
    const pending = stack.some(
      (f) =>
        f.kind === "event" &&
        !f.cancelled &&
        (f.stage === "interrupts" || f.stage === "apply") &&
        f.event.kind === "dealDamage" &&
        f.event.fromAttack &&
        !f.event.spilledFromFrameId &&
        f.event.parentFrameId === frame.eventFrameId,
    );
    if (pending) queuedFor.add(frame.eventFrameId);
  }
  const waiting = (f: Frame<"event">): boolean => !f.cancelled && (f.stage === "interrupts" || f.stage === "apply");
  const mark = (frame: StackFrame): StackFrame => {
    if (frame.kind === "enemyAttack") {
      return !frame.versusEnemy && frame.stage !== "done" ? { ...frame, playerEliminated: true as const } : frame;
    }
    if (frame.kind !== "event" || !waiting(frame)) return frame;
    const event = frame.event;
    const queued =
      (event.kind === "dealDamage" &&
        event.fromAttack &&
        !event.spilledFromFrameId &&
        event.parentFrameId != null &&
        queuedFor.has(event.parentFrameId)) ||
      (event.kind === "characterAttacked" && frame.responsesWith !== undefined && queuedFor.has(frame.responsesWith));
    // An enemy attack is underway once its interrupt window has opened (`apply`); at `interrupts` it has not begun.
    const begun = event.kind === "enemyAttack" && frame.stage === "apply";
    return begun || queued ? { ...frame, enemyAttackEndedByElimination: true as const } : frame;
  };
  ctx.state = { ...ctx.state, stack: stack.map(mark) };
}

/**
 * Takes off a `dealDamage` or `characterAttacked` of an enemy attack a player's elimination ended while its damage was
 * queued (`markEnemyAttacksUnderway`): the damage is not dealt and nothing is attacked. The attack's end is logged once,
 * with its damage. True when the frame was taken off.
 */
export function endedEnemyAttackPart(ctx: Ctx, frame: Frame<"event">): boolean {
  if (frame.enemyAttackEndedByElimination !== true) return false;
  if (frame.stage !== "interrupts" && frame.stage !== "apply") return false;
  const event = frame.event;
  if (event.kind !== "dealDamage" && event.kind !== "characterAttacked") return false;
  if (event.kind === "dealDamage" && event.sourceInstanceId !== null) {
    emit(ctx, {
      type: "activationSkipped",
      enemyInstanceId: event.sourceInstanceId,
      activation: "attack",
      reason: "playerEliminated",
    });
  }
  popFrame(ctx);
  return true;
}
