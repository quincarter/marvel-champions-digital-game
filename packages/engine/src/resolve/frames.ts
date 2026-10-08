/** Building stack frames and pushing events, effects and abilities onto the stack. */

import type { AbilityId, AbilityReference, CardId } from "@mc/content";
import { type Ctx, nextFrameId, pushFrames, updateFrame } from "../ctx.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { cardOf, villainOf, villainStageOf } from "../query.js";
import { activeAbilityRefs, controllerOf, printedAbilityRefs, textBoxBlankFor, withSelfHost } from "../select.js";
import type { EffectSpec } from "../spec.js";
import {
  type Bindings,
  playPaymentVars,
  type ReportTarget,
  type SetupInstructionSource,
  type StackFrame,
  type TriggerCandidate,
  type Vars,
  type UndeclaredWilds,
} from "../stack.js";
import { carriedByEvent, isAnnouncement, type TriggerEvent } from "../trigger-events.js";
import { placeExhausted } from "../effects.js";
import { entersPlayExhausted } from "../rules.js";
import { hasCandidates } from "./triggers.js";

export type Frame<K extends StackFrame["kind"]> = Extract<StackFrame, { kind: K }>;

export const base = (ctx: Ctx) => ({ frameId: nextFrameId(ctx), answer: null }) as const;

/**
 * `vars` seeds the frame's activation record. An enemy attack/scheme reads its modifications (`atkBonus`, `schBonus`,
 * `overkill`, `extraBoost`, `boostIconsEach`, `threatBonus`) off the event frame, and `modifyAttack` adds to them
 * while the activation is in progress; seeding them here is how an effect that *initiates* an activation scopes a bonus
 * to exactly it ("Green Goblin attacks with +X ATK").
 */
export const eventFrame = (
  ctx: Ctx,
  event: TriggerEvent,
  reportTo: ReportTarget | null = null,
  vars: Vars = {},
): StackFrame => {
  if (event.kind === "cardEntersPlay") placeEnteringExhausted(ctx, event.instanceId);
  return frameOf(ctx, event, reportTo, vars);
};

/**
 * "Your allies, upgrades, and supports enter play exhausted." (`RuleSpec entersPlayExhausted`, docs/phase7-wave7.md
 * §3.36.) Every card entering play, by whatever route, puts a `cardEntersPlay` event on the stack through `eventFrame`
 * once the card is in its zone and under its controller, so the rule is read here and nowhere else: a new way into play
 * cannot miss it. It is read as the frame is built, not as it resolves, so of several cards one effect puts into play,
 * none is ready while an earlier one's "enters play" windows are open.
 *
 * The rules in force are the ones in play at that moment (RRG 1.8 "Ability", p. 4: a constant ability "remains active
 * while the card is in play"): once the rule's card has left play the next card enters ready, and a card it placed
 * exhausted stays so until something readies it.
 */
function placeEnteringExhausted(ctx: Ctx, id: InstanceId): void {
  if (!ctx.state.instances[id] || !entersPlayExhausted(ctx.state, ctx.deps, id)) return;
  placeExhausted(ctx, id);
}

/**
 * A new face "treated as entering play" though the card never left it (a flip, `flipToOtherFace`): the same
 * announcement, with its enter-play keywords and windows, but no entering in the sense of RRG 1.8 "Enters Play" (p. 18:
 * "transitions from an out-of-play area into play"), so an "enters play exhausted" rule does not read it.
 */
export function announceNewFaceEntersPlay(ctx: Ctx, id: InstanceId, playerId: PlayerId | null): FrameId {
  const frame = frameOf(ctx, { kind: "cardEntersPlay", instanceId: id, playerId }, null, {});
  pushFrames(ctx, [frame]);
  return frame.frameId;
}

const frameOf = (ctx: Ctx, event: TriggerEvent, reportTo: ReportTarget | null, vars: Vars): StackFrame => ({
  ...base(ctx),
  kind: "event",
  event: withDefeatSnapshot(ctx, event),
  stage: isAnnouncement(event) && !interruptibleFlip(ctx, event) ? "responses" : "interrupts",
  cancelled: false,
  vars,
  slots: {},
  reportTo,
  endEffects: [],
});

/**
 * "Forced Interrupt: When a character flips …, move all threat from that character to this scheme" (MojoMania 1B,
 * `mojo` 39025b; docs/phase7-wave6.md §3.59, §4 Q34). A hero's change of form (`formChanged`) and a card's flip
 * (`cardFlipped`) are announced once the card has turned; the card keeps its threat, damage and counters through a flip,
 * so an interrupt window opened then reads what it held. It opens only when an interrupt listens, so every other flip
 * keeps its response-only frame and its log.
 */
const interruptibleFlip = (ctx: Ctx, event: TriggerEvent): boolean =>
  (event.kind === "formChanged" || event.kind === "cardFlipped") &&
  hasCandidates(ctx.state, ctx.deps, event, "interrupt");

/**
 * A defeat carries what was attached to the character when it was initiated (`characterDefeated.attachedInstanceIds`,
 * docs/phase7-wave4.md §3.22), so a response after the character has left play can still ask "the enemy with Death-Glow
 * attached". Taken once, when the event goes on the stack; an event that already has one keeps it.
 *
 * A villain's defeat carries the number of the stage that falls the same way (`characterDefeated.villainStageNumber`,
 * docs/phase7-wave7.md §3.34): the sweep stamps its own before asking who hears it, and a defeat by effect gets it here.
 */
function withDefeatSnapshot(ctx: Ctx, event: TriggerEvent): TriggerEvent {
  if (event.kind !== "characterDefeated") return event;
  const staged =
    event.villainStageNumber === undefined && villainOf(ctx.state, event.instanceId)
      ? { ...event, villainStageNumber: villainStageOf(ctx.state, event.instanceId).stageNumber }
      : event;
  if (staged.attachedInstanceIds) return staged;
  const attached = ctx.state.instances[event.instanceId]?.attachments ?? [];
  return attached.length === 0 ? staged : { ...staged, attachedInstanceIds: [...attached] };
}

/** Puts an event on the stack: interrupt window, the change itself, response window. */
export function pushEvent(ctx: Ctx, event: TriggerEvent, reportTo: ReportTarget | null = null): FrameId {
  const frame = eventFrame(ctx, event, reportTo);
  pushFrames(ctx, [frame]);
  return frame.frameId;
}

/** Adds `delta` into the vars of a frame that carries vars (event, effects, ability, playCard frames). */
export function addFrameVars(
  ctx: Ctx,
  frameId: FrameId | null | undefined,
  delta: Readonly<Record<string, number>>,
): void {
  if (!frameId || Object.keys(delta).length === 0) return;
  updateFrame(ctx, frameId, (frame) => {
    if (frame.kind !== "event" && frame.kind !== "effects" && frame.kind !== "ability" && frame.kind !== "playCard")
      return frame;
    const vars: Record<string, number> = { ...frame.vars };
    for (const [key, amount] of Object.entries(delta)) vars[key] = (vars[key] ?? 0) + amount;
    return { ...frame, vars };
  });
}

/** Adds cards to a frame's named slots (event frames: `slots`; effect/ability/play frames: `bindings`). */
export function addFrameSlots(
  ctx: Ctx,
  frameId: FrameId | null | undefined,
  delta: Readonly<Record<string, readonly InstanceId[]>>,
): void {
  if (!frameId || Object.keys(delta).length === 0) return;
  const merge = (current: Bindings): Bindings => {
    const next: Record<string, readonly InstanceId[]> = { ...current };
    for (const [key, ids] of Object.entries(delta)) next[key] = [...new Set([...(next[key] ?? []), ...ids])];
    return next;
  };
  updateFrame(ctx, frameId, (frame) => {
    if (frame.kind === "event") return { ...frame, slots: merge(frame.slots) };
    if (frame.kind === "effects" || frame.kind === "ability" || frame.kind === "playCard")
      return { ...frame, bindings: merge(frame.bindings) };
    return frame;
  });
}

/**
 * Several events at once, in the order they were listed: `events[0]` resolves
 * first. `pushFrames` prepends, so anything that queues per-target events in a
 * loop has to build the whole batch before pushing or it resolves backwards.
 */
export function pushEvents(
  ctx: Ctx,
  events: readonly TriggerEvent[],
  reportTo: ReportTarget | null = null,
  vars: Vars = {},
): readonly FrameId[] {
  // Each event gets its own copy of `vars`: "each enemy attacks with +X ATK" is +X per attack, never cumulative.
  const frames = events.map((event) => eventFrame(ctx, event, reportTo, { ...vars }));
  pushFrames(ctx, frames);
  // In `events` order, so the last id is the event that resolves last.
  return frames.map((frame) => frame.frameId);
}

/**
 * Several triggering conditions one occurrence created, resolved in the order listed (`events[0]` first, as
 * `pushEvents`), sharing a single response window (RRG 1.8 "Triggering Condition", p. 45: "those triggering conditions
 * are handled with … a single response window"). The last event's frame opens that window once every earlier one has
 * handed over its resolved event (`responsesWith` / `joinedResponses`), so forced responses to any of them resolve
 * before optional ones to any (RRG 1.8 "Simultaneous Timing Priority", p. 5). Each event keeps its own interrupt window
 * and apply step.
 */
export function pushEventsSharingResponses(ctx: Ctx, events: readonly TriggerEvent[]): readonly FrameId[] {
  if (events.length <= 1) return pushEvents(ctx, events);
  const frames = events.map((event) => eventFrame(ctx, event));
  const leader = frames[frames.length - 1]!.frameId;
  pushFrames(
    ctx,
    frames.map((frame) =>
      frame.kind === "event" && frame.frameId !== leader ? { ...frame, responsesWith: leader } : frame,
    ),
  );
  // In `events` order, as `pushEvents`: the last id is the frame that opens the shared window.
  return frames.map((frame) => frame.frameId);
}

/** An event whose state change has already happened; only responses can fire. */
export const announce = (ctx: Ctx, event: TriggerEvent): FrameId => pushEvent(ctx, event);

export function pushEffects(
  ctx: Ctx,
  spec: {
    readonly effects: readonly EffectSpec[];
    readonly selfInstanceId: InstanceId | null;
    readonly controllerId: PlayerId | null;
    readonly event?: TriggerEvent | null;
    readonly eventFrameId?: FrameId | null;
    readonly bindings?: Bindings;
    readonly vars?: Vars;
    readonly scopedPlayerId?: PlayerId | null;
    /** A branch whose bindings go back to this frame when it finishes (docs/phase7-wave4.md §3.43). */
    readonly returnBindingsTo?: FrameId;
    /** With `returnBindingsTo`: returned under `<prefix>.`, merged (docs/phase7-wave5.md §3.7). */
    readonly returnBindingsPrefix?: string;
    /** The effects of an ability a player uses (docs/phase7-wave4.md §3.44). */
    readonly byPlayer?: boolean;
    /** The ability these effects belong to (`Frame<"effects">.abilityId`, docs/phase7-wave6.md §3.84). */
    readonly abilityId?: AbilityId | undefined;
    /** The setup instruction the parent frame resolves, carried on to its branches (`SetupInstructionSource`). */
    readonly instruction?: SetupInstructionSource | undefined;
    /**
     * A branch of a defeated card's leaving step (`resolve/event.ts` `leaveAfterWhenDefeated`), which carries it on, so
     * its leave still reads the defeat's source rather than its own card (docs/phase7-wave5.md §4.1 Q46).
     */
    readonly defeatedLeaving?: InstanceId;
    readonly defeatedLeavingSource?: CardId;
  },
): void {
  if (spec.effects.length === 0) return;
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "effects",
      effects: spec.effects,
      cursor: 0,
      bindings: spec.bindings ?? {},
      vars: spec.vars ?? {},
      scopedPlayerId: spec.scopedPlayerId ?? null,
      selfInstanceId: spec.selfInstanceId,
      controllerId: spec.controllerId,
      event: spec.event ?? null,
      eventFrameId: spec.eventFrameId ?? null,
      ...(spec.returnBindingsTo ? { returnBindingsTo: spec.returnBindingsTo } : {}),
      ...(spec.returnBindingsTo && spec.returnBindingsPrefix
        ? { returnBindingsPrefix: spec.returnBindingsPrefix }
        : {}),
      ...(spec.byPlayer ? { byPlayer: true as const } : {}),
      ...(spec.abilityId !== undefined ? { abilityId: spec.abilityId } : {}),
      ...(spec.instruction ? { instruction: spec.instruction } : {}),
      ...(spec.defeatedLeaving !== undefined ? { defeatedLeaving: spec.defeatedLeaving } : {}),
      ...(spec.defeatedLeavingSource !== undefined ? { defeatedLeavingSource: spec.defeatedLeavingSource } : {}),
    },
  ]);
}

export function abilityFrame(
  ctx: Ctx,
  candidate: TriggerCandidate,
  event: TriggerEvent | null,
  eventFrameId: FrameId | null,
  bindings: Bindings = {},
  vars: Vars = {},
  /** The ability's payment holds wilds its controller has still to declare (`Frame<"ability">.undeclaredWilds`). */
  undeclaredWilds?: UndeclaredWilds,
): StackFrame {
  return {
    ...base(ctx),
    ...(undeclaredWilds ? { undeclaredWilds } : {}),
    kind: "ability",
    instanceId: candidate.instanceId,
    abilityId: candidate.abilityId,
    controllerId: candidate.controllerId,
    event,
    eventFrameId,
    // Read before the cost is paid: "discard this card →" leaves the effect's "attached scheme" readable (`SELF_HOST`).
    // What the answered moment carries is the ability's to read as `moment.<slot>` (`carriedByEvent`, §3.71).
    bindings: withSelfHost(ctx.state, candidate.instanceId, { ...carriedByEvent(event).bindings, ...bindings }),
    // The ability's own vars win: an ability paid for with its own resource cost (`payWindowAbility`) keeps that payment.
    vars: { ...playPaymentVars(ctx.state.stack, candidate.instanceId), ...carriedByEvent(event).vars, ...vars },
  };
}

/** Puts an activated `action` ability on the stack once its costs have been paid. */
export function pushActionAbility(
  ctx: Ctx,
  instanceId: InstanceId,
  abilityId: AbilityId,
  controllerId: PlayerId | null,
  bindings: Bindings = {},
  vars: Vars = {},
  undeclaredWilds?: UndeclaredWilds,
): void {
  pushFrames(ctx, [
    abilityFrame(
      ctx,
      { instanceId, abilityId, controllerId, forced: false, fromHand: false },
      null,
      null,
      bindings,
      vars,
      undeclaredWilds,
    ),
  ]);
}

/**
 * `attachInstruction` is not a trigger kind: it asks for the abilities flagged `AbilityDefinition.attachInstruction`,
 * which every other kind (their carrier `whenRevealed` included) leaves out (docs/phase7-wave7.md §3.35).
 */
type GameAbilityKind =
  | "whenRevealed"
  | "whenDefeated"
  | "whenCompleted"
  | "boost"
  | "setup"
  | "cannotAttach"
  | "attachInstruction";

/**
 * Game-triggered ability frames (When Revealed, When Defeated, Boost, Setup) in
 * card order. Returned rather than pushed so a caller sweeping several cards can
 * push one batch and keep them in sweep order.
 */
export function gameAbilityFrames(
  ctx: Ctx,
  instanceId: InstanceId,
  kinds: readonly GameAbilityKind[],
  event: TriggerEvent | null,
  /** Explicit ability slots to scan instead of the card's live ones (main scheme A sides). */
  refsOverride?: readonly AbilityReference[],
  /**
   * Who "you" is for a card nobody controls (encounter and scenario cards): the
   * revealing player, the attacked/scheming player for a boost, the engaged
   * player for a minion's When Defeated, the first player for scheme and villain
   * abilities.
   */
  actingPlayerId: PlayerId | null = null,
): readonly StackFrame[] {
  const card = cardOf(ctx.state, instanceId);
  if (!card || (!refsOverride && textBoxBlankFor(ctx.state, instanceId, ctx.deps))) return [];
  // Villains, main schemes and identities print abilities for every face/stage;
  // only the active one is live.
  // A flipped encounter card's live abilities are its other face's (RRG 1.8 "Flip").
  const refs =
    refsOverride ??
    (card.type === "villain" ||
    card.type === "main_scheme" ||
    card.type === "hero_identity" ||
    ctx.state.instances[instanceId]?.flipped
      ? activeAbilityRefs(ctx.state, instanceId, ctx.deps)
      : printedAbilityRefs(card));
  const frames: StackFrame[] = [];
  for (const ref of refs) {
    const definition = ctx.deps.abilities[ref.id];
    if (!definition) continue;
    const kind = definition.attachInstruction ? "attachInstruction" : definition.trigger.kind;
    if (!kinds.includes(kind as GameAbilityKind)) continue;
    frames.push(
      abilityFrame(
        ctx,
        {
          instanceId,
          abilityId: ref.id,
          controllerId: controllerOf(ctx.state, instanceId) ?? actingPlayerId,
          forced: true,
          fromHand: false,
        },
        event,
        null,
      ),
    );
  }
  return frames;
}

export function pushGameAbilities(
  ctx: Ctx,
  instanceId: InstanceId,
  kinds: readonly GameAbilityKind[],
  event: TriggerEvent | null,
): void {
  pushFrames(ctx, gameAbilityFrames(ctx, instanceId, kinds, event));
}
