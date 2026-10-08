/**
 * `EffectSpec assignDamage` with `sequential` (docs/phase7-wave8.md §3.37): a pool of damage dealt to one character at
 * a time, each settled before the next is chosen.
 *
 * MC45 p. 6, step 4 of a mission attempt: "Deal damage from this pool to enemies at the mission one at a time until
 * there is no damage in the pool or there are no enemies remaining at the mission." RRG 1.8 "Damage" (p. 14), "Defeat"
 * (p. 15). The chooser picks a character that can take damage and how much of the pool it is dealt, from 1 to its
 * remaining hit points; that damage resolves as one damage event, with any defeat, When Defeated and Victory it
 * causes, before the next pick. So a character that could not take damage while another stood ("cannot take damage
 * while another minion is at the mission") is offered once that one has fallen. What is left when nobody can take
 * damage is lost. The damage is the ability's, not an attack: no attacker, retaliate or overkill.
 *
 * The amount is the player's because a pick is one instance of damage (RRG 1.8 "Tough", p. 45: a tough status card
 * prevents "any amount of damage" once), so 1 damage to remove a tough status card and the rest afterward is a
 * different result from all of it at once.
 */

import type { ChoiceOption } from "../choices.js";
import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { mustCardOf, remainingHitPoints } from "../query.js";
import { cannotTakeDamage } from "../rules.js";
import { type EffectContext, resolvePlayers, resolveValue, selectTargets } from "../select.js";
import type { EffectSpec } from "../spec.js";
import { effectChoiceAuthority } from "../villain/authority.js";
import { type Frame, pushEvents } from "./frames.js";

const LEFT = "_pool.left";
const POOL = "_pool.size";
const TARGET = "_pool.target";

export function executeSequentialDamage(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "assignDamage" }>,
  context: EffectContext,
): void {
  const source = frame.selfInstanceId;
  const vars: Record<string, number> = { ...frame.vars };
  if (vars[LEFT] === undefined) {
    vars[LEFT] = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
    vars[POOL] = vars[LEFT];
  }
  const left = vars[LEFT] ?? 0;
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const roomOf = (id: InstanceId): number => Math.max(0, remainingHitPoints(ctx.state, id, ctx.deps) ?? 0);
  const { [TARGET]: held, ...bindings } = frame.bindings;

  const deal = (target: InstanceId, amount: number): void => {
    setFrame(ctx, { ...frame, answer: null, bindings, vars: { ...vars, [LEFT]: left - amount } });
    // Above this frame: the damage, and whatever it causes, resolves before this effect looks at the pool again.
    pushEvents(ctx, [
      { kind: "dealDamage", targetInstanceId: target, amount, sourceInstanceId: source, fromAttack: false },
    ]);
  };

  if (frame.answer !== null) {
    const [answered] = frame.answer;
    const target = held?.[0];
    if (target === undefined) {
      // The answer is the character. With room for more than 1, how much of the pool is the next question.
      const picked = answered as InstanceId | undefined;
      const cap = picked === undefined ? 0 : Math.min(left, roomOf(picked));
      if (picked === undefined || cap <= 0) return void setFrame(ctx, { ...frame, answer: null, bindings, vars });
      if (cap === 1 || !chooser) return deal(picked, cap);
      setFrame(ctx, { ...frame, answer: null, bindings: { ...bindings, [TARGET]: [picked] }, vars });
      requestChoice(ctx, {
        playerId: chooser,
        authority: effectChoiceAuthority(ctx.state, source, effect.chooser),
        prompt: { kind: "chooseNumber", min: 1, max: cap },
        options: Array.from({ length: cap }, (_, index) => ({
          optionId: String(index + 1),
          label: String(index + 1),
          ref: { kind: "none" } as const,
        })),
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    const cap = Math.min(left, roomOf(target));
    const amount = Number(answered);
    return deal(target, Number.isInteger(amount) && amount >= 1 && amount <= cap ? amount : cap);
  }

  const candidates = selectTargets(ctx.state, effect.among, context).filter(
    (id) => roomOf(id) > 0 && !cannotTakeDamage(ctx.state, ctx.deps, id, [source]),
  );
  if (left > 0 && candidates.length > 0 && chooser) {
    setFrame(ctx, { ...frame, answer: null, bindings, vars });
    const options: readonly ChoiceOption[] = candidates.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id },
    }));
    requestChoice(ctx, {
      playerId: chooser,
      authority: effectChoiceAuthority(ctx.state, source, effect.chooser),
      prompt: { kind: "chooseTarget", slot: "assignDamage", abilityId: null },
      options,
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }

  // The pool is empty, or nobody can take what is left: the rest is lost.
  const pool = vars[POOL] ?? 0;
  const { [LEFT]: _left, [POOL]: _pool, ...cleaned } = vars;
  const bound = effect.bind
    ? { [`${effect.bind}.dealt`]: pool - left, [`${effect.bind}.lost`]: left, [`${effect.bind}.amount`]: pool }
    : {};
  setFrame(ctx, { ...frame, answer: null, bindings, vars: { ...cleaned, ...bound }, cursor: frame.cursor + 1 });
  emit(ctx, {
    type: "damagePoolResolved",
    playerId: chooser ?? null,
    sourceInstanceId: source,
    pool,
    dealt: pool - left,
    lost: left,
  });
}
