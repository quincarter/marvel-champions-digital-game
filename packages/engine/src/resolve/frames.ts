/** Building stack frames and pushing events, effects and abilities onto the stack. */

import type { AbilityId, AbilityReference } from "@mc/content";
import { type Ctx, nextFrameId, pushFrames, updateFrame } from "../ctx.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { cardOf, textBoxBlank } from "../query.js";
import { activeAbilityRefs, controllerOf, printedAbilityRefs } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { Bindings, ReportTarget, StackFrame, TriggerCandidate, Vars } from "../stack.js";
import { isAnnouncement, type TriggerEvent } from "../trigger-events.js";

export type Frame<K extends StackFrame["kind"]> = Extract<StackFrame, { kind: K }>;

export const base = (ctx: Ctx) => ({ frameId: nextFrameId(ctx), answer: null }) as const;

/**
 * `vars` seeds the frame's activation record. An enemy attack/scheme reads its modifications (`atkBonus`, `schBonus`,
 * `overkill`, `extraBoost`, `threatBonus`) off the event frame, and `modifyAttack` adds to them while the activation
 * is in progress; seeding them here is how an effect that *initiates* an activation scopes a bonus to exactly it
 * ("Green Goblin attacks with +X ATK").
 */
export const eventFrame = (ctx: Ctx, event: TriggerEvent, reportTo: ReportTarget | null = null, vars: Vars = {}): StackFrame => ({
  ...base(ctx),
  kind: "event",
  event,
  stage: isAnnouncement(event) ? "responses" : "interrupts",
  cancelled: false,
  vars,
  slots: {},
  reportTo,
  endEffects: [],
});

/** Puts an event on the stack: interrupt window, the change itself, response window. */
export function pushEvent(ctx: Ctx, event: TriggerEvent, reportTo: ReportTarget | null = null): FrameId {
  const frame = eventFrame(ctx, event, reportTo);
  pushFrames(ctx, [frame]);
  return frame.frameId;
}

/** Adds `delta` into the vars of a frame that carries vars (event, effects, ability, playCard frames). */
export function addFrameVars(ctx: Ctx, frameId: FrameId | null | undefined, delta: Readonly<Record<string, number>>): void {
  if (!frameId || Object.keys(delta).length === 0) return;
  updateFrame(ctx, frameId, (frame) => {
    if (frame.kind !== "event" && frame.kind !== "effects" && frame.kind !== "ability" && frame.kind !== "playCard") return frame;
    const vars: Record<string, number> = { ...frame.vars };
    for (const [key, amount] of Object.entries(delta)) vars[key] = (vars[key] ?? 0) + amount;
    return { ...frame, vars };
  });
}

/** Adds cards to a frame's named slots (event frames: `slots`; effect/ability/play frames: `bindings`). */
export function addFrameSlots(ctx: Ctx, frameId: FrameId | null | undefined, delta: Readonly<Record<string, readonly InstanceId[]>>): void {
  if (!frameId || Object.keys(delta).length === 0) return;
  const merge = (current: Bindings): Bindings => {
    const next: Record<string, readonly InstanceId[]> = { ...current };
    for (const [key, ids] of Object.entries(delta)) next[key] = [...new Set([...(next[key] ?? []), ...ids])];
    return next;
  };
  updateFrame(ctx, frameId, (frame) => {
    if (frame.kind === "event") return { ...frame, slots: merge(frame.slots) };
    if (frame.kind === "effects" || frame.kind === "ability" || frame.kind === "playCard") return { ...frame, bindings: merge(frame.bindings) };
    return frame;
  });
}


/**
 * Several events at once, in the order they were listed: `events[0]` resolves
 * first. `pushFrames` prepends, so anything that queues per-target events in a
 * loop has to build the whole batch before pushing or it resolves backwards.
 */
export function pushEvents(ctx: Ctx, events: readonly TriggerEvent[], reportTo: ReportTarget | null = null, vars: Vars = {}): void {
  pushFrames(
    ctx,
    // Each event gets its own copy of `vars`: "each enemy attacks with +X ATK" is +X per attack, never cumulative.
    events.map((event) => eventFrame(ctx, event, reportTo, { ...vars })),
  );
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
    },
  ]);
}

/**
 * What was paid to play this card, while its play is still resolving (its `playCard` frame is on the stack): the
 * `paid.*` vars. RRG 1.8 "Cost" (p. 13): the resources spent to play a card are "paid for that card", so "if you paid
 * for this card using a [energy] resource" is a fact about the card's own play. Valkyrie's "Response: After Valkyrie
 * enters play" resolves inside that play (RRG 1.8 "Initiating Abilities", p. 25, step 7: the card enters play, and a
 * response resolves immediately after), but in its own ability frame, which otherwise starts with no vars.
 *
 * Scoped to the play in progress, not to the card for as long as it stays in play: every "if you paid for this card"
 * card in the pool so far reads it while the card is being played. A card put into play without being played has no
 * `playCard` frame, so it reads as paid with nothing.
 */
function playPaymentVars(ctx: Ctx, instanceId: InstanceId): Vars {
  const play = ctx.state.stack.find((frame) => frame.kind === "playCard" && frame.instanceId === instanceId);
  if (play?.kind !== "playCard") return {};
  // `overpaid.*` and a chosen `x` travel the same way ("for each resource you overpaid", Ant-Man ally; docs/phase7-wave2.md
  // §3.8).
  return Object.fromEntries(Object.entries(play.vars).filter(([key]) => key.startsWith("paid.") || key.startsWith("overpaid.") || key === "x"));
}

export function abilityFrame(
  ctx: Ctx,
  candidate: TriggerCandidate,
  event: TriggerEvent | null,
  eventFrameId: FrameId | null,
  bindings: Bindings = {},
  vars: Vars = {},
): StackFrame {
  return {
    ...base(ctx),
    kind: "ability",
    instanceId: candidate.instanceId,
    abilityId: candidate.abilityId,
    controllerId: candidate.controllerId,
    event,
    eventFrameId,
    bindings,
    // The ability's own vars win: an ability paid for with its own resource cost (`payWindowAbility`) keeps that payment.
    vars: { ...playPaymentVars(ctx, candidate.instanceId), ...vars },
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
): void {
  pushFrames(ctx, [
    abilityFrame(ctx, { instanceId, abilityId, controllerId, forced: false, fromHand: false }, null, null, bindings, vars),
  ]);
}

type GameAbilityKind = "whenRevealed" | "whenDefeated" | "whenCompleted" | "boost" | "setup";

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
  if (!card || (!refsOverride && textBoxBlank(ctx.state, instanceId))) return [];
  // Villains, main schemes and identities print abilities for every face/stage;
  // only the active one is live.
  // A flipped encounter card's live abilities are its other face's (RRG 1.8 "Flip").
  const refs =
    refsOverride ??
    (card.type === "villain" || card.type === "main_scheme" || card.type === "hero_identity" || ctx.state.instances[instanceId]?.flipped
      ? activeAbilityRefs(ctx.state, instanceId)
      : printedAbilityRefs(card));
  const frames: StackFrame[] = [];
  for (const ref of refs) {
    const definition = ctx.deps.abilities[ref.id];
    if (!definition) continue;
    if (!kinds.includes(definition.trigger.kind as GameAbilityKind)) continue;
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
