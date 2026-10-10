/**
 * Allies and minions defeated by one effect resolve together (docs/phase7-wave5.md §4.1 Q49).
 *
 * "One effect" is one defeat sweep's allies and minions — the sweep after one damage event, or after a simultaneous
 * damage group (one `dealDamage` with several targets, or indirect damage, which is "first assigned and then resolved
 * simultaneously", RRG 1.8 "Indirect Damage", p. 24) — or the targets of one "defeat each …" effect. Damage one effect
 * deals to several characters "is dealt simultaneously; resolve damage steps for both enemies at the same time per
 * Simultaneous Timing Priority rules" (ruling, June 2, 2026 (2) answer 1), so each step RRG 1.8 "Damage" (p. 14) lists
 * after the damage is placed is taken for all of them at once:
 *
 * 1. Step 6 (and the non-When-Defeated half of step 7): one interrupt window for all their defeats, as for any one
 *    occurrence's several triggering conditions (RRG 1.8 "Triggering Condition", p. 45). An interrupt that cancels or
 *    replaces one defeat leaves the others imminent (`stillImminent`).
 * 2. Every defeat that still happens, happens (logged, reported to the damage), in sweep order.
 * 3. Any overkill spill, in sweep order: "Overkill damage is simultaneous with the damage from the attack" (MC50
 *    rulebook FAQ, p. 22), so it lands, and a "would be defeated" interrupt on the character it lands on resolves,
 *    before any When Defeated ability (`beginDefeat`, `resolve/event.ts`).
 * 4. Step 7: every When Defeated ability. Each is "Forced Interrupt: When this card is defeated" (RRG 1.8 "When
 *    Defeated Abilities", p. 48), so those on different cards share a bold timing trigger and the first player orders
 *    them ("Simultaneous Resolution", p. 40; "First Player", p. 19). One card's own abilities keep their printed order.
 *    Every defeated card is still in play while they resolve ("A defeated card leaves play after its 'When Defeated'
 *    ability is resolved", p. 48), and none can be defeated again (`defeatPending`).
 * 5. Step 8: every card still in play showing the defeated face leaves from one step, so their "when this leaves play"
 *    interrupts, and those of the attachments leaving with them, share one window, and their leavings one response
 *    window (§4.1 Q32–Q33, `openLeavingInterrupts`). Victory X, a "… instead" destination and the Permanent keyword are
 *    each card's own, as for a card defeated alone (`defeatFromPlay`).
 * 6. Step 9: one response window for all the defeats.
 *
 * A villain or identity in the same sweep is not a member: it is removed from the game or eliminated rather than
 * discarded, and keeps its own path (`checkDefeats`). One character defeated alone keeps `applyDefeat`'s path, frame
 * for frame. Nothing here opens a window or asks a question unless something is there to answer it.
 */

import { type Ctx, emit, pushFrames, requestChoice, setFrame, updateFrame } from "../ctx.js";
import { defeatFromPlay } from "../effects.js";
import type { FrameId, InstanceId } from "../ids.js";
import { characterProfile, getInstance } from "../query.js";
import { cardsInPlay } from "../select.js";
import type { DefeatedTogetherMember, EffectSpec } from "../spec.js";
import type { StackFrame, TriggerCandidate } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { simultaneousOrderer } from "../villain/authority.js";
import { beginDefeat } from "./event.js";
import { base, eventFrame, type Frame, gameAbilityFrames } from "./frames.js";
import { hasCandidates } from "./triggers.js";
import { candidateOption, pushWindow } from "./window.js";

type Defeat = Extract<TriggerEvent, { kind: "characterDefeated" }>;
type DefeatedTogether = Extract<EffectSpec, { kind: "defeatedTogether" }>;

/** An ally or minion: defeated, it is discarded (RRG 1.8 "Defeat", p. 15), so it can be one of several together. */
const joinsTogether = (ctx: Ctx, event: Defeat): boolean => {
  const kind = characterProfile(ctx.state, event.instanceId, ctx.deps)?.kind;
  return kind === "ally" || kind === "minion";
};

/**
 * The frames for the defeats one effect causes, in the order given (`frames[0]` resolves first). With two or more
 * allies or minions among them, those go on together where the first of them stood: one event frame per defeat for its
 * interrupts, then the `defeatedTogether` step that does the rest. Otherwise one event frame each, as ever.
 */
export function defeatFrames(ctx: Ctx, events: readonly Defeat[]): readonly StackFrame[] {
  const together = events.filter((event) => joinsTogether(ctx, event));
  if (together.length < 2) return events.map((event) => eventFrame(ctx, event));
  const coordinator = base(ctx);
  const members = together.map((event, index): Frame<"event"> => ({
    ...(eventFrame(ctx, event) as Frame<"event">),
    group: { frameId: coordinator.frameId, index },
  }));
  const step: DefeatedTogether = {
    kind: "defeatedTogether",
    stage: "apply",
    members: members.map((member) => ({ event: member.event as Defeat, cancelled: false })),
  };
  const group: StackFrame = {
    ...coordinator,
    kind: "effects",
    effects: [step],
    cursor: 0,
    bindings: {},
    vars: {},
    scopedPlayerId: null,
    selfInstanceId: null,
    controllerId: null,
    event: null,
    eventFrameId: null,
  };
  const frames: StackFrame[] = [];
  let placed = false;
  for (const event of events) {
    if (!joinsTogether(ctx, event)) frames.push(eventFrame(ctx, event));
    else if (!placed) {
      frames.push(...members, group);
      placed = true;
    }
  }
  return frames;
}

/** Pushes the defeats one effect causes (`defeatFrames`), `events[0]` resolving first. */
export function pushDefeats(ctx: Ctx, events: readonly Defeat[]): void {
  pushFrames(ctx, defeatFrames(ctx, events));
}

/** The `defeatedTogether` step a frame is running, if it is one. */
const stepOf = (frame: StackFrame): DefeatedTogether | undefined => {
  if (frame.kind !== "effects") return undefined;
  const effect = frame.effects[frame.cursor];
  return effect?.kind === "defeatedTogether" ? effect : undefined;
};

/**
 * A member's defeat is under way while its step has not reached its responses: waiting for the others' interrupts, the
 * When Defeated abilities, or its leave window (`defeatPending`). It is still in play at zero remaining hit points, and
 * a sweep must not defeat it a second time.
 */
export function defeatedTogetherPending(frame: StackFrame, id: InstanceId): boolean {
  const step = stepOf(frame);
  if (!step || step.stage === "responses") return false;
  return step.members.some(
    (member) => member.event.instanceId === id && !member.cancelled && (step.stage === "apply" || !!member.defeated),
  );
}

/**
 * A member has been defeated (its `beginDefeat` happened) and has not left play yet: its When Defeated abilities or its
 * leaving step are still to come. Narrower than `defeatedTogetherPending`, which also covers a member whose defeat is
 * only imminent (`alreadyDefeated`).
 */
export function defeatedTogetherDefeated(frame: StackFrame, id: InstanceId): boolean {
  const step = stepOf(frame);
  if (!step || step.stage === "apply" || step.stage === "responses") return false;
  return step.members.some((member) => member.event.instanceId === id && !member.cancelled && !!member.defeated);
}

/** A member's event frame hands back its defeat, as its interrupts left it (`resolve/event.ts`'s group branch). */
export function withDefeatedMember(frame: StackFrame, index: number, event: Defeat, cancelled: boolean): StackFrame {
  const step = stepOf(frame);
  if (frame.kind !== "effects" || !step) return frame;
  const members = step.members.map((member, i) => (i === index ? { ...member, event, cancelled } : member));
  return { ...frame, effects: frame.effects.map((e, i) => (i === frame.cursor ? { ...step, members } : e)) };
}

/**
 * The interrupts stage of the first member of a `defeatedTogether` group: every member's defeat shares one interrupt
 * window, opened here over all of them, and each then hands its defeat back to the group (the way
 * `openLeavingInterrupts` batches the cards leaving from one step, docs/phase7-wave5.md §4.1 Q33). False for any other
 * frame.
 */
export function openDefeatedTogetherInterrupts(ctx: Ctx, frame: Frame<"event">): boolean {
  if (!frame.group || frame.event.kind !== "characterDefeated") return false;
  const groupId = frame.group.frameId;
  const group = ctx.state.stack.find((f) => f.frameId === groupId);
  if (!group || !stepOf(group)) return false;
  const batch = ctx.state.stack.filter(
    (f): f is Frame<"event"> => f.kind === "event" && f.stage === "interrupts" && f.group?.frameId === groupId,
  );
  for (const member of batch) {
    emit(ctx, { type: "triggerEvent", event: member.event, phase: "initiated" });
    updateFrame(ctx, member.frameId, (f) => (f.kind === "event" ? { ...f, stage: "apply" } : f));
  }
  const [leader, ...others] = batch;
  if (leader && batch.some((member) => hasCandidates(ctx.state, ctx.deps, member.event, "interrupt"))) {
    pushWindow(
      ctx,
      leader.event,
      "interrupt",
      leader.frameId,
      others.map((other) => other.event),
      others.map((other): FrameId | null => other.frameId),
    );
  }
  return true;
}

/** Runs the `defeatedTogether` step's next stage (see the module docblock). */
export function executeDefeatedTogether(ctx: Ctx, frame: Frame<"effects">, step: DefeatedTogether): void {
  const advance = (next: DefeatedTogether | null) =>
    setFrame(ctx, {
      ...frame,
      answer: null,
      ...(next
        ? { effects: frame.effects.map((e, i) => (i === frame.cursor ? next : e)) }
        : { cursor: frame.cursor + 1 }),
    });
  switch (step.stage) {
    case "apply": {
      const spills: StackFrame[] = [];
      const members = step.members.map((member): DefeatedTogetherMember => {
        if (member.cancelled) return member;
        const begun = beginDefeat(ctx, member.event);
        if (typeof begun === "boolean") return member;
        // Dealt now, before the When Defeated abilities, so it is not kept for the legacy `spill` stage.
        const { spill, ...followUp } = begun;
        if (spill) spills.push(eventFrame(ctx, spill));
        return { ...member, defeated: followUp };
      });
      advance({ ...step, stage: "whenDefeated", members });
      pushFrames(ctx, spills);
      return;
    }
    case "whenDefeated": {
      const byCard = step.members.map((member) =>
        member.defeated
          ? gameAbilityFrames(
              ctx,
              member.event.instanceId,
              ["whenDefeated"],
              member.event,
              undefined,
              member.defeated.actingPlayerId,
            )
          : [],
      );
      let frames = byCard.flat();
      // Several cards' When Defeated abilities: the first player orders them (RRG 1.8 p. 40).
      if (byCard.filter((own) => own.length > 0).length > 1) {
        const key = (f: StackFrame): string => (f.kind === "ability" ? `${f.instanceId}:${f.abilityId}` : "");
        if (frame.answer === null) {
          const candidates = frames.flatMap((f): TriggerCandidate[] =>
            f.kind === "ability"
              ? [
                  {
                    instanceId: f.instanceId,
                    abilityId: f.abilityId,
                    controllerId: f.controllerId,
                    forced: true,
                    fromHand: false,
                  },
                ]
              : [],
          );
          const first = step.members.find((member) => member.defeated) ?? step.members[0];
          if (!first) return;
          requestChoice(ctx, {
            playerId: simultaneousOrderer(ctx.state),
            authority: "firstPlayerOrders",
            prompt: { kind: "orderTriggers", event: first.event, timing: "interrupt" },
            options: candidates.map(candidateOption(ctx.state)),
            minSelections: candidates.length,
            maxSelections: candidates.length,
            frameId: frame.frameId,
            ordered: true,
          });
          return;
        }
        const answer = frame.answer;
        frames = [...frames].sort((a, b) => answer.indexOf(key(a)) - answer.indexOf(key(b)));
      }
      advance({ ...step, stage: "leave" });
      pushFrames(ctx, frames);
      return;
    }
    case "leave": {
      // Every card leaves from this one step, so their waiting leavings share one interrupt and one response window.
      advance({ ...step, stage: "spill" });
      const inPlay = cardsInPlay(ctx.state);
      for (const member of step.members) {
        const followUp = member.defeated;
        const id = member.event.instanceId;
        // Still in play showing the face that was defeated: a When Defeated may have moved it or flipped it already,
        // or attached it to another card, where it stays (docs/phase7-wave7.md §3.44).
        const instance = getInstance(ctx.state, id);
        if (!followUp || !inPlay.includes(id) || instance?.cardId !== followUp.printedId) continue;
        if (!followUp.attached && instance.attachedTo !== null) continue;
        defeatFromPlay(ctx, id, followUp.insteadTo, followUp.sourceCardId);
      }
      return;
    }
    case "spill": {
      // Only a game saved mid-step before 2026-10-10 still carries a spill here: it is dealt at `apply` now.
      advance({ ...step, stage: "responses" });
      pushFrames(
        ctx,
        step.members.flatMap((member) => (member.defeated?.spill ? [eventFrame(ctx, member.defeated.spill)] : [])),
      );
      return;
    }
    case "responses": {
      advance(null);
      const frames = step.members
        .filter((member) => member.defeated)
        .map((member): Frame<"event"> => ({
          ...base(ctx),
          kind: "event",
          event: member.event,
          stage: "responses",
          cancelled: false,
          vars: {},
          slots: {},
          reportTo: null,
          endEffects: [],
        }));
      const leader = frames[frames.length - 1]?.frameId;
      pushFrames(
        ctx,
        frames.map((f) => (leader !== undefined && f.frameId !== leader ? { ...f, responsesWith: leader } : f)),
      );
      return;
    }
  }
}
