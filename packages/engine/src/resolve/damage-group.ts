/**
 * Simultaneous damage (RRG 1.8 "Indirect Damage", p. 24: "All indirect damage from a single source is first assigned
 * and then resolved simultaneously"). A `damageGroup` frame runs three stages over its members:
 *
 * 1. each member's interrupt window, as a real `dealDamage` event frame, so "prevent N of that damage" and "cannot take
 *    damage" work on each instance (ruling, Aug 3, 2026 (2) answer 1: a reduction applies to indirect damage assigned
 *    to that character);
 * 2. every member's damage, then one defeat sweep, so no instance is resolved before another is dealt;
 * 3. each member's response window, with its results, so every response sees every instance already dealt.
 */

import { type Ctx, popFrame, pushFrames, setFrame } from "../ctx.js";
import { characterProfile, getInstance } from "../query.js";
import { controllerOf } from "../select.js";
import type { ReportTarget, StackFrame, Vars } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { checkDefeats } from "./defeat.js";
import { applyDamage, excessDamageOf } from "./event.js";
import { base, type Frame } from "./frames.js";

type DamageEvent = Extract<TriggerEvent, { kind: "dealDamage" }>;

export const damageGroupFrame = (
  ctx: Ctx,
  events: readonly DamageEvent[],
  reportTo: ReportTarget | null,
): StackFrame => ({
  ...base(ctx),
  kind: "damageGroup",
  members: events.map((event) => ({ event, cancelled: false, vars: {} })),
  stage: "interrupts",
  cursor: 0,
  reportTo,
});

export function executeDamageGroupFrame(ctx: Ctx, frame: Frame<"damageGroup">): void {
  switch (frame.stage) {
    case "interrupts": {
      const member = frame.members[frame.cursor];
      if (!member) {
        setFrame(ctx, { ...frame, stage: "apply", cursor: 0 });
        return;
      }
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      pushFrames(ctx, [
        {
          ...base(ctx),
          kind: "event",
          event: member.event,
          stage: "interrupts",
          cancelled: false,
          vars: {},
          slots: {},
          reportTo: null,
          endEffects: [],
          group: { frameId: frame.frameId, index: frame.cursor },
        },
      ]);
      return;
    }
    case "apply": {
      const members: Frame<"damageGroup">["members"][number][] = [];
      for (const member of frame.members) {
        if (member.cancelled) {
          members.push(member);
          continue;
        }
        const target = member.event.targetInstanceId;
        const before = getInstance(ctx.state, target)?.damage ?? 0;
        const maxHp = characterProfile(ctx.state, target, ctx.deps)?.maxHp;
        applyDamage(ctx, member.event, frame.frameId, false);
        const vars: Record<string, number> = {};
        const taken = (getInstance(ctx.state, target)?.damage ?? before) - before;
        if (taken > 0) vars.amount = taken;
        // The same excess `applyDamage` measures: taken beyond remaining hit points, plus Follow Through's bonus
        // (RRG 1.8 "Overkill", p. 31).
        const excessDealt = excessDamageOf(ctx, member.event, before, taken, maxHp);
        if (excessDealt > 0) vars.excessDealt = excessDealt;
        members.push({ ...member, vars: vars as Vars });
      }
      setFrame(ctx, { ...frame, members, stage: "responses" });
      // What dealt each member's damage, so a defeat knows its source and whether it was an attack's (an enemy attack
      // that deals indirect damage, docs/phase7-wave3.md §3.16 and §3.45).
      checkDefeats(
        ctx,
        frame.members
          .filter((member) => !member.cancelled)
          .map((member) => {
            const source = member.event.sourceInstanceId;
            return {
              targetId: member.event.targetInstanceId,
              parentFrameId: member.event.parentFrameId ?? null,
              overkill: undefined,
              defeatedByPlayerId: source !== null ? controllerOf(ctx.state, source) : null,
              sourceInstanceId: source,
              fromAttack: member.event.fromAttack,
            };
          }),
      );
      return;
    }
    case "responses": {
      setFrame(ctx, { ...frame, stage: "done" });
      pushFrames(
        ctx,
        frame.members
          .filter((member) => !member.cancelled)
          .map((member): StackFrame => ({
            ...base(ctx),
            kind: "event",
            event: member.event,
            stage: "responses",
            cancelled: false,
            vars: member.vars,
            slots: {},
            reportTo: frame.reportTo,
            endEffects: [],
          })),
      );
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}
