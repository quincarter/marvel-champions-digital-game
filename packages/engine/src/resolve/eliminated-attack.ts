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
import type { FrameId, InstanceId } from "../ids.js";
import type { TriggerEvent } from "../trigger-events.js";
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
 * - **Its damage queued but not yet dealt**: the procedure has finished and handed its damage on, and the attack's
 *   `characterAttacked` waits beneath it. Whatever still holds that damage is marked, and the `characterAttacked` too
 *   (taken off unapplied: nothing was attacked, so no retaliate):
 *   - a `dealDamage` event in its own "when … would take damage" interrupt window (`endedEnemyAttackPart`);
 *   - the effect assigning an attack's indirect damage or dividing it evenly (`dealIndirectDamage`,
 *     `divideDamageEvenly`; Starshark, Bombshell), before or while its shares are chosen. It assigns nothing and asks
 *     nothing more; a choice it has open is withdrawn (`endedAttackAssignment`);
 *   - the simultaneous group of those shares (`damageGroup`, RRG 1.8 "Indirect Damage", p. 24: "resolved
 *     simultaneously") while each share's interrupt window is open: no share is dealt, the ones whose windows have
 *     closed included, since none is dealt before every window has (`endedAttackDamageGroup`).
 *
 * Damage the attack has already dealt stays dealt, and an attack whose damage has been dealt is left alone (its
 * `characterAttacked` and response window follow as before): a share group that has applied its damage, or an
 * overkill spill from it. Not marked: an enemy's attack on another enemy (`versusEnemy`, Headpool; engine reading, the
 * boost player is not attacked).
 */
export function markEnemyAttacksUnderway(ctx: Ctx): void {
  const stack = ctx.state.stack;
  const queuedFor = new Set<FrameId>();
  for (const frame of stack) {
    if (frame.kind !== "enemyAttack" || frame.versusEnemy || frame.stage !== "done" || frame.eventFrameId === null) {
      continue;
    }
    const attack = frame.eventFrameId;
    if (stack.some((f) => holdsAttackDamage(f, attack))) queuedFor.add(attack);
  }
  const waiting = (f: Frame<"event">): boolean => !f.cancelled && (f.stage === "interrupts" || f.stage === "apply");
  const mark = (frame: StackFrame): StackFrame => {
    if (frame.kind === "enemyAttack") {
      return !frame.versusEnemy && frame.stage !== "done" ? { ...frame, playerEliminated: true as const } : frame;
    }
    if (frame.kind === "effects" || frame.kind === "damageGroup") {
      return [...queuedFor].some((attack) => holdsAttackDamage(frame, attack))
        ? { ...frame, enemyAttackEndedByElimination: true as const }
        : frame;
    }
    if (frame.kind !== "event" || !waiting(frame)) return frame;
    const event = frame.event;
    const queued =
      (event.kind === "dealDamage" &&
        event.parentFrameId != null &&
        queuedFor.has(event.parentFrameId) &&
        holdsAttackDamage(frame, event.parentFrameId)) ||
      (event.kind === "characterAttacked" && frame.responsesWith !== undefined && queuedFor.has(frame.responsesWith));
    // An enemy attack is underway once its interrupt window has opened (`apply`); at `interrupts` it has not begun.
    const begun = event.kind === "enemyAttack" && frame.stage === "apply";
    return begun || queued ? { ...frame, enemyAttackEndedByElimination: true as const } : frame;
  };
  const marked = stack.map(mark);
  // A share assignment the ended attack had open is withdrawn: nobody is left with a choice for damage not dealt.
  const open = ctx.state.pendingChoice?.frameId;
  const withdrawn = open != null && marked.some((f) => f.frameId === open && isEndedAssignment(f));
  ctx.state = { ...ctx.state, stack: marked, ...(withdrawn ? { pendingChoice: null } : {}) };
}

const isAttackDamage = (event: TriggerEvent, attack: FrameId): boolean =>
  event.kind === "dealDamage" && event.fromAttack && !event.spilledFromFrameId && event.parentFrameId === attack;

const isEndedAssignment = (frame: StackFrame): boolean =>
  frame.kind === "effects" && frame.enemyAttackEndedByElimination === true;

/**
 * `frame` still holds damage of the enemy attack whose event frame is `attack`, not yet dealt: a `dealDamage` event
 * waiting at its interrupt window, the effect that assigns the attack's indirect or evenly divided damage (at that
 * effect), or the group of those shares while their interrupt windows are open (RRG 1.8 "Indirect Damage", p. 24).
 */
function holdsAttackDamage(frame: StackFrame, attack: FrameId): boolean {
  if (frame.kind === "event") {
    return (
      !frame.cancelled &&
      (frame.stage === "interrupts" || frame.stage === "apply") &&
      isAttackDamage(frame.event, attack)
    );
  }
  if (frame.kind === "damageGroup") {
    return frame.stage === "interrupts" && frame.members.some((member) => isAttackDamage(member.event, attack));
  }
  if (frame.kind === "effects") {
    const effect = frame.effects[frame.cursor];
    return (
      frame.eventFrameId === attack &&
      (effect?.kind === "dealIndirectDamage" || effect?.kind === "divideDamageEvenly") &&
      effect.fromAttack === true
    );
  }
  return false;
}

const logEnded = (ctx: Ctx, enemyInstanceId: InstanceId | null): void => {
  if (enemyInstanceId === null) return;
  emit(ctx, { type: "activationSkipped", enemyInstanceId, activation: "attack", reason: "playerEliminated" });
};

/**
 * The effect assigning an ended enemy attack's indirect or evenly divided damage (`markEnemyAttacksUnderway`): it
 * assigns and asks nothing more, and the program goes on past it with what it had chosen so far dropped (`cleanVars`).
 * True when it was skipped.
 */
export function endedAttackAssignment(
  ctx: Ctx,
  frame: Frame<"effects">,
  cleanVars: (vars: Frame<"effects">["vars"]) => Frame<"effects">["vars"],
): boolean {
  if (frame.enemyAttackEndedByElimination !== true) return false;
  logEnded(ctx, frame.selfInstanceId);
  const { enemyAttackEndedByElimination: _ended, ...rest } = frame;
  setFrame(ctx, { ...rest, answer: null, vars: cleanVars(frame.vars), cursor: frame.cursor + 1 });
  return true;
}

/**
 * The simultaneous group of an ended enemy attack's damage shares, its interrupt windows still open
 * (`markEnemyAttacksUnderway`): none of its shares is dealt. True when it was taken off.
 */
export function endedAttackDamageGroup(ctx: Ctx, frame: Frame<"damageGroup">): boolean {
  if (frame.enemyAttackEndedByElimination !== true || frame.stage !== "interrupts") return false;
  logEnded(ctx, frame.members[0]?.event.sourceInstanceId ?? null);
  popFrame(ctx);
  return true;
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
  // A share of a damage group leaves alone; the group logs the attack's end as it is taken off.
  if (event.kind === "dealDamage" && frame.group === undefined) logEnded(ctx, event.sourceInstanceId);
  popFrame(ctx);
  return true;
}
