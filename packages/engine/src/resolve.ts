import type { AbilityId, AnyCard } from "@mc/content";
import { abilityUseKey, type AbilityDefinition, type EngineDeps, type EventPattern } from "./abilities.js";
import { paymentOptions, paymentsFromOptionIds, payPayment, priceOrNull } from "./actions.js";
import type { ChoiceOption } from "./choices.js";
import {
  emit,
  moveCard,
  nextFrameId,
  popFrame,
  pushFrames,
  setFrame,
  requestChoice,
  updateFrame,
  updateInstance,
  updatePlayer,
  type Ctx,
} from "./ctx.js";
import {
  addAccelerationToken,
  addCounters,
  dealEncounterCardTo,
  discardFromHand,
  discardFromPlay,
  drawCards,
  drawEncounterCard,
  endGame,
  exhaustCard,
  giveStatus,
  healDamage,
  pierceTough,
  readyCard,
  removeAccelerationToken,
  removeCounters,
  removeStatus,
} from "./effects.js";
import { EngineInvariantError } from "./errors.js";
import { instanceId as asInstanceId, type FrameId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword, keywordTotal, keywordsOf } from "./keywords.js";
import {
  cardOf,
  characterProfile,
  getInstance,
  getPlayer,
  mainSchemeStage,
  mainSchemeStageCount,
  mustCardOf,
  mustInstance,
  mustPlayer,
  nextClockwisePlayer,
  playerOrder,
  scale,
  villainStageCount,
} from "./query.js";
import { nextInt } from "./rng.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  controllerOf,
  evaluate,
  matchesQuery,
  printedAbilityRefs,
  resolvePlayers,
  resolveRef,
  resolveValue,
  restrictedCardsOf,
  selectTargets,
  type EffectContext,
} from "./select.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import {
  candidateOf,
  type Bindings,
  type StackFrame,
  type TriggerCandidate,
  type WindowTiming,
} from "./stack.js";
import type { Form, GameState, ZoneId } from "./state.js";
import { eventSubjects, isAnnouncement, type TriggerEvent } from "./trigger-events.js";

// ---------------------------------------------------------------------------
// Frame construction
// ---------------------------------------------------------------------------

const base = (ctx: Ctx) => ({ frameId: nextFrameId(ctx), answer: null }) as const;

const eventFrame = (ctx: Ctx, event: TriggerEvent): StackFrame => ({
  ...base(ctx),
  kind: "event",
  event,
  stage: isAnnouncement(event) ? "responses" : "interrupts",
  cancelled: false,
});

/** Puts an event on the stack: interrupt window, the change itself, response window. */
export function pushEvent(ctx: Ctx, event: TriggerEvent): FrameId {
  const frame = eventFrame(ctx, event);
  pushFrames(ctx, [frame]);
  return frame.frameId;
}

/**
 * Several events at once, in the order they were listed: `events[0]` resolves
 * first. `pushFrames` prepends, so anything that queues per-target events in a
 * loop has to build the whole batch before pushing or it resolves backwards.
 */
export function pushEvents(ctx: Ctx, events: readonly TriggerEvent[]): void {
  pushFrames(
    ctx,
    events.map((event) => eventFrame(ctx, event)),
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
      selfInstanceId: spec.selfInstanceId,
      controllerId: spec.controllerId,
      event: spec.event ?? null,
      eventFrameId: spec.eventFrameId ?? null,
    },
  ]);
}

function abilityFrame(
  ctx: Ctx,
  candidate: TriggerCandidate,
  event: TriggerEvent | null,
  eventFrameId: FrameId | null,
): StackFrame {
  return {
    ...base(ctx),
    kind: "ability",
    instanceId: candidate.instanceId,
    abilityId: candidate.abilityId,
    controllerId: candidate.controllerId,
    event,
    eventFrameId,
  };
}

/** Puts an activated `action` ability on the stack once its costs have been paid. */
export function pushActionAbility(
  ctx: Ctx,
  instanceId: InstanceId,
  abilityId: AbilityId,
  controllerId: PlayerId | null,
): void {
  pushFrames(ctx, [
    abilityFrame(ctx, { instanceId, abilityId, controllerId, forced: false, fromHand: false }, null, null),
  ]);
}

type GameAbilityKind = "whenRevealed" | "whenDefeated" | "boost" | "setup";

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
): readonly StackFrame[] {
  const card = cardOf(ctx.state, instanceId);
  if (!card) return [];
  // Villains, main schemes and identities print abilities for every face/stage;
  // only the active one is live.
  const refs =
    card.type === "villain" || card.type === "main_scheme" || card.type === "hero_identity"
      ? activeAbilityRefs(ctx.state, instanceId)
      : printedAbilityRefs(card);
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
          controllerId: controllerOf(ctx.state, instanceId),
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

// ---------------------------------------------------------------------------
// Trigger matching
// ---------------------------------------------------------------------------

function matchesPattern(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
): boolean {
  if (pattern.on !== event.kind) return false;
  const subjects = eventSubjects(event);
  if (pattern.selfIs === "source" && !subjects.sources.includes(selfId)) return false;
  if (pattern.selfIs === "target" && !subjects.targets.includes(selfId)) return false;
  if (
    pattern.selfIs === "either" &&
    !subjects.sources.includes(selfId) &&
    !subjects.targets.includes(selfId)
  ) {
    return false;
  }
  const controller = controllerOf(state, selfId);
  if (pattern.playerIs === "controller") {
    if (!controller) return false;
    // RRG p.9: "after [enemy] attacks you" resolves for the attacked player, not the defender.
    const attackedPlayer =
      pattern.usesAttackedPlayer && event.kind === "enemyAttack" ? event.attackedPlayerId : null;
    if (attackedPlayer !== null) {
      if (controller !== attackedPlayer) return false;
    } else if (!subjects.players.includes(controller)) {
      return false;
    }
  }
  if (pattern.fromAttack !== undefined) {
    if (event.kind !== "dealDamage" || event.fromAttack !== pattern.fromAttack) return false;
  }
  if (pattern.targetIs) {
    const query: TargetQuery = pattern.targetIs;
    const context: EffectContext = {
      selfInstanceId: selfId,
      controllerId: controller,
      event,
      bindings: {},
    };
    if (!subjects.targets.some((target) => matchesQuery(state, target, query, context))) return false;
  }
  return true;
}

function limitReached(state: GameState, id: InstanceId, abilityId: AbilityId, definition: AbilityDefinition): boolean {
  if (!definition.limit) return false;
  return (state.abilityUses[abilityUseKey(id, abilityId)] ?? 0) >= definition.limit.count;
}

/** RRG "Hero Interrupt"/"Alter-Ego Response": the gate is on the controller's current form. */
const formSatisfied = (state: GameState, controllerId: PlayerId | null, form: Form | undefined): boolean => {
  if (!form) return true;
  if (!controllerId) return false;
  return getPlayer(state, controllerId)?.identity.form === form;
};

function candidatesFor(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  const found: TriggerCandidate[] = [];
  for (const id of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, id)) {
      const definition = deps.abilities[ref.id];
      if (!definition) continue;
      const trigger = definition.trigger;
      if (trigger.kind !== timing || trigger.forced !== forced) continue;
      const controllerId = controllerOf(state, id);
      if (!formSatisfied(state, controllerId, trigger.form)) continue;
      if (limitReached(state, id, ref.id, definition)) continue;
      if (!matchesPattern(state, trigger.on, event, id)) continue;
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId, definition }, forced));
    }
  }
  if (!forced) found.push(...inHandCandidates(state, deps, event, timing));
  return found;
}

/**
 * RRG "Event" + "Interrupt"/"Response": an event whose ability is an interrupt
 * or a response is played from hand *inside* the matching timing window, so the
 * window has to offer each player their matching in-hand events alongside the
 * optional abilities already in play. Playing one is never forced, so these only
 * ever appear in the optional tier.
 */
function inHandCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
): readonly TriggerCandidate[] {
  const found: TriggerCandidate[] = [];
  for (const player of playerOrder(state)) {
    for (const id of player.hand) {
      const card = cardOf(state, id);
      if (card?.type !== "event") continue;
      for (const ref of card.abilities) {
        const definition = deps.abilities[ref.id];
        if (!definition) continue;
        const trigger = definition.trigger;
        if (trigger.kind !== timing || trigger.forced) continue;
        if (!formSatisfied(state, player.playerId, trigger.form)) continue;
        if (!matchesPattern(state, trigger.on, event, id)) continue;
        found.push({
          instanceId: id,
          abilityId: ref.id,
          controllerId: player.playerId,
          forced: false,
          fromHand: true,
        });
      }
    }
  }
  return found;
}

const hasCandidates = (state: GameState, deps: EngineDeps, event: TriggerEvent, timing: WindowTiming): boolean =>
  candidatesFor(state, deps, event, timing, true).length > 0 ||
  candidatesFor(state, deps, event, timing, false).length > 0;

function pushWindow(ctx: Ctx, event: TriggerEvent, timing: WindowTiming, eventFrameId: FrameId | null): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "window",
      event,
      timing,
      eventFrameId,
      tierIndex: 0,
      queue: [],
      askingPlayerIds: [],
      pending: [],
      awaiting: null,
      paying: null,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Frame execution
// ---------------------------------------------------------------------------

export function executeFrame(ctx: Ctx): void {
  const frame = ctx.state.stack[0];
  if (!frame) throw new EngineInvariantError("executeFrame with an empty stack");
  switch (frame.kind) {
    case "event":
      return executeEventFrame(ctx, frame);
    case "window":
      return executeWindowFrame(ctx, frame);
    case "ability":
      return executeAbilityFrame(ctx, frame);
    case "effects":
      return executeEffectsFrame(ctx, frame);
    case "enemyAttack":
      return executeEnemyAttackFrame(ctx, frame);
    case "enemyScheme":
      return executeEnemySchemeFrame(ctx, frame);
    case "reveal":
      return executeRevealFrame(ctx, frame);
    case "playCard":
      return executePlayCardFrame(ctx, frame);
  }
}

type Frame<K extends StackFrame["kind"]> = Extract<StackFrame, { kind: K }>;

function executeEventFrame(ctx: Ctx, frame: Frame<"event">): void {
  switch (frame.stage) {
    case "interrupts": {
      emit(ctx, { type: "triggerEvent", event: frame.event, phase: "initiated" });
      setFrame(ctx, { ...frame, stage: "apply" });
      if (hasCandidates(ctx.state, ctx.deps, frame.event, "interrupt")) {
        pushWindow(ctx, frame.event, "interrupt", frame.frameId);
      }
      return;
    }
    case "apply": {
      if (frame.cancelled) {
        // RRG "Cancel": the canceled effect is not considered to have occurred, so no responses.
        emit(ctx, { type: "triggerEvent", event: frame.event, phase: "cancelled" });
        popFrame(ctx);
        return;
      }
      setFrame(ctx, { ...frame, stage: "responses" });
      applyEvent(ctx, frame.event);
      return;
    }
    case "responses": {
      emit(ctx, { type: "triggerEvent", event: frame.event, phase: "resolved" });
      setFrame(ctx, { ...frame, stage: "done" });
      if (hasCandidates(ctx.state, ctx.deps, frame.event, "response")) {
        pushWindow(ctx, frame.event, "response", frame.frameId);
      }
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

/** RRG "Ability — Simultaneous Timing Priority": forced abilities before non-forced. */
const TIERS: readonly boolean[] = [true, false];

function executeWindowFrame(ctx: Ctx, frame: Frame<"window">): void {
  if (frame.answer) return absorbWindowAnswer(ctx, frame, frame.answer);
  if (frame.askingPlayerIds.length > 0) return askNextController(ctx, frame);
  if (frame.queue.length > 0) {
    const [next, ...rest] = frame.queue;
    if (!next) throw new EngineInvariantError("empty trigger queue");
    if (next.fromHand) return requestWindowPayment(ctx, frame, next, rest);
    setFrame(ctx, { ...frame, queue: rest });
    pushFrames(ctx, [abilityFrame(ctx, next, frame.event, frame.eventFrameId)]);
    return;
  }
  const forced = TIERS[frame.tierIndex];
  if (forced === undefined) {
    popFrame(ctx);
    return;
  }
  const candidates = candidatesFor(ctx.state, ctx.deps, frame.event, frame.timing, forced);
  const advanced = { ...frame, tierIndex: frame.tierIndex + 1, pending: candidates };
  if (candidates.length === 0) {
    setFrame(ctx, advanced);
    return;
  }
  emit(ctx, {
    type: "windowOpened",
    event: frame.event,
    timing: frame.timing,
    candidates: candidates.map((c) => ({ instanceId: c.instanceId, abilityId: c.abilityId, forced: c.forced })),
  });
  if (forced) {
    if (candidates.length === 1) {
      setFrame(ctx, { ...advanced, queue: candidates, pending: [] });
      return;
    }
    // RRG "Forced"/"Simultaneous Resolution": the first player orders simultaneous effects.
    setFrame(ctx, { ...advanced, awaiting: "order" });
    requestChoice(ctx, {
      playerId: ctx.state.firstPlayerId,
      prompt: { kind: "orderTriggers", event: frame.event, timing: frame.timing },
      options: candidates.map(candidateOption(ctx.state)),
      minSelections: candidates.length,
      maxSelections: candidates.length,
      frameId: frame.frameId,
      ordered: true,
    });
    return;
  }
  const askingPlayerIds = controllersToAsk(ctx.state, candidates);
  setFrame(ctx, { ...advanced, askingPlayerIds });
}

const candidateOption =
  (state: GameState) =>
  (candidate: TriggerCandidate): ChoiceOption => ({
    optionId: `${candidate.instanceId}:${candidate.abilityId}`,
    label: cardOf(state, candidate.instanceId)?.name ?? candidate.instanceId,
    ref: { kind: "ability", instanceId: candidate.instanceId, abilityId: candidate.abilityId },
  });

/**
 * Optional abilities belong to their controller. Abilities on encounter cards
 * can be triggered by any player (RRG "Ability"); the engine offers them to the
 * first player, which is a simplification worth revisiting for multiplayer.
 */
function controllersToAsk(state: GameState, candidates: readonly TriggerCandidate[]): readonly PlayerId[] {
  const owners = new Set(candidates.map((c) => c.controllerId ?? state.firstPlayerId));
  return playerOrder(state)
    .map((p) => p.playerId)
    .filter((id) => owners.has(id));
}

function askNextController(ctx: Ctx, frame: Frame<"window">): void {
  const [current, ...rest] = frame.askingPlayerIds;
  if (!current) throw new EngineInvariantError("no controller left to ask");
  const mine = frame.pending.filter((c) => (c.controllerId ?? ctx.state.firstPlayerId) === current);
  if (mine.length === 0) {
    setFrame(ctx, { ...frame, askingPlayerIds: rest });
    return;
  }
  setFrame(ctx, { ...frame, awaiting: "select" });
  requestChoice(ctx, {
    playerId: current,
    prompt: { kind: "chooseTriggers", event: frame.event, timing: frame.timing },
    options: mine.map(candidateOption(ctx.state)),
    minSelections: 0,
    maxSelections: mine.length,
    frameId: frame.frameId,
    ordered: true,
  });
}

const cardCost = (state: GameState, id: InstanceId): number => {
  const card = cardOf(state, id);
  return card && "cost" in card ? card.cost : 0;
};

function requestWindowPayment(
  ctx: Ctx,
  frame: Frame<"window">,
  candidate: TriggerCandidate,
  rest: readonly TriggerCandidate[],
): void {
  const controller = candidate.controllerId;
  if (!controller) {
    setFrame(ctx, { ...frame, queue: rest });
    return;
  }
  const options = paymentOptions(ctx, controller, candidate.instanceId);
  setFrame(ctx, { ...frame, queue: rest, awaiting: "pay", paying: candidate });
  requestChoice(ctx, {
    playerId: controller,
    prompt: {
      kind: "payForCard",
      instanceId: candidate.instanceId,
      abilityId: candidate.abilityId,
      cost: cardCost(ctx.state, candidate.instanceId),
    },
    options,
    minSelections: 0,
    maxSelections: options.length,
    frameId: frame.frameId,
  });
}

/**
 * RRG "Initiating Abilities": the cost is paid, then the event is played and
 * only the ability that matched this window resolves. Selecting nothing (or too
 * little) is how a player backs out — the card stays in hand.
 */
function playWindowEvent(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  const candidate = frame.paying;
  setFrame(ctx, { ...frame, answer: null, awaiting: null, paying: null });
  const controller = candidate?.controllerId;
  if (!candidate || !controller) return;
  if (!mustPlayer(ctx.state, controller).hand.includes(candidate.instanceId)) return;
  const payment = paymentsFromOptionIds(answer);
  const paid = priceOrNull(ctx, controller, payment, candidate.instanceId);
  const cost = cardCost(ctx.state, candidate.instanceId);
  if (paid === null || paid < cost) return;
  payPayment(ctx, controller, payment);
  emit(ctx, {
    type: "cardPlayed",
    playerId: controller,
    instanceId: candidate.instanceId,
    cardId: mustInstance(ctx.state, candidate.instanceId).cardId,
    resourcesPaid: paid,
  });
  pushPlayCardFrame(ctx, candidate.instanceId, controller, null, {
    triggeredAbilityId: candidate.abilityId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
  });
}

function absorbWindowAnswer(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  if (frame.awaiting === "pay") return playWindowEvent(ctx, frame, answer);
  const byOption = new Map(frame.pending.map((c) => [`${c.instanceId}:${c.abilityId}`, c]));
  const picked = answer
    .map((optionId) => byOption.get(optionId))
    .filter((c): c is TriggerCandidate => c !== undefined);
  if (frame.awaiting === "order") {
    setFrame(ctx, { ...frame, answer: null, awaiting: null, queue: picked, pending: [] });
    return;
  }
  const [, ...rest] = frame.askingPlayerIds;
  setFrame(ctx, {
    ...frame,
    answer: null,
    awaiting: null,
    queue: [...frame.queue, ...picked],
    askingPlayerIds: rest,
  });
}

function executeAbilityFrame(ctx: Ctx, frame: Frame<"ability">): void {
  const definition = ctx.deps.abilities[frame.abilityId];
  popFrame(ctx);
  if (!definition) return;
  if (limitReached(ctx.state, frame.instanceId, frame.abilityId, definition)) return;
  recordAbilityUse(ctx, frame.instanceId, frame.abilityId, definition);
  emit(ctx, {
    type: "abilityResolved",
    instanceId: frame.instanceId,
    abilityId: frame.abilityId,
    controllerId: frame.controllerId,
  });
  pushEffects(ctx, {
    effects: definition.effects,
    selfInstanceId: frame.instanceId,
    controllerId: frame.controllerId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
  });
}

export function recordAbilityUse(
  ctx: Ctx,
  instanceId: InstanceId,
  abilityId: AbilityId,
  definition: AbilityDefinition,
): void {
  if (!definition.limit) return;
  const key = abilityUseKey(instanceId, abilityId);
  const uses = (ctx.state.abilityUses[key] ?? 0) + 1;
  ctx.state = { ...ctx.state, abilityUses: { ...ctx.state.abilityUses, [key]: uses } };
  emit(ctx, { type: "abilityUseRecorded", instanceId, abilityId, uses });
}

/** RRG "Limit": counters reset at the boundary of the named period. */
export function clearAbilityUses(ctx: Ctx, period: "turn" | "phase" | "round"): void {
  const kept: Record<string, number> = {};
  for (const [key, uses] of Object.entries(ctx.state.abilityUses)) {
    const abilityId = key.slice(key.indexOf(":") + 1);
    const definition = ctx.deps.abilities[abilityId];
    if (definition?.limit && definition.limit.period !== period) kept[key] = uses;
  }
  ctx.state = { ...ctx.state, abilityUses: kept };
}

// ---------------------------------------------------------------------------
// Effect interpretation
// ---------------------------------------------------------------------------

const contextOf = (frame: Frame<"effects">): EffectContext => ({
  selfInstanceId: frame.selfInstanceId,
  controllerId: frame.controllerId,
  event: frame.event,
  bindings: frame.bindings,
});

function executeEffectsFrame(ctx: Ctx, frame: Frame<"effects">): void {
  const effect = frame.effects[frame.cursor];
  if (!effect) {
    popFrame(ctx);
    return;
  }
  const context = contextOf(frame);

  if (effect.kind === "chooseTarget") {
    if (frame.answer === null) return requestTargetChoice(ctx, frame, effect, context);
    const chosen = frame.answer.filter((id) => id !== "none").map((id) => asInstanceId(id));
    emit(ctx, { type: "targetChosen", slot: effect.slot, instanceIds: chosen });
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      bindings: { ...frame.bindings, [effect.slot]: chosen },
    });
    return;
  }
  if (effect.kind === "discardFromHand" && effect.random !== true) {
    const [playerId] = resolvePlayers(ctx.state, effect.player, context);
    const player = playerId ? getPlayer(ctx.state, playerId) : undefined;
    const amount = Math.min(resolveValue(ctx.state, effect.amount, context), player?.hand.length ?? 0);
    if (!playerId || !player || amount <= 0) {
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      return;
    }
    if (frame.answer === null) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseTarget", slot: "discard", abilityId: null },
        options: player.hand.map((id) => ({
          optionId: id,
          label: mustCardOf(ctx.state, id).name,
          ref: { kind: "card", instanceId: id },
        })),
        minSelections: amount,
        maxSelections: amount,
        frameId: frame.frameId,
      });
      return;
    }
    for (const optionId of frame.answer) discardFromHand(ctx, playerId, asInstanceId(optionId));
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
    return;
  }

  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  applyEffect(ctx, effect, context, frame);
}

function requestTargetChoice(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseTarget" }>,
  context: EffectContext,
): void {
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const legal = selectTargets(ctx.state, effect.query, context);
  if (!chooser || legal.length === 0) {
    // RRG "Choose (Game Element)": with no legal target there is nothing to choose.
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  const count = Math.min(effect.count ?? 1, legal.length);
  requestChoice(ctx, {
    playerId: chooser,
    prompt: { kind: "chooseTarget", slot: effect.slot, abilityId: null },
    options: legal.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: effect.optional ? 0 : count,
    maxSelections: count,
    frameId: frame.frameId,
  });
}

function applyEffect(
  ctx: Ctx,
  effect: EffectSpec,
  context: EffectContext,
  frame: Frame<"effects">,
): void {
  const targets = (ref: Parameters<typeof resolveRef>[1]): readonly InstanceId[] =>
    resolveRef(ctx.state, ref, context).filter((id) => getInstance(ctx.state, id) !== undefined);
  const value = (spec: Parameters<typeof resolveValue>[1]): number => resolveValue(ctx.state, spec, context);

  switch (effect.kind) {
    case "dealDamage": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "dealDamage",
          targetInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
          fromAttack: effect.fromAttack === true,
        })),
      );
      return;
    }
    case "heal": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({ kind: "healDamage", targetInstanceId: id, amount })),
      );
      return;
    }
    case "placeThreat": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "placeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
        })),
      );
      return;
    }
    case "removeThreat": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "removeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
        })),
      );
      return;
    }
    case "draw": {
      const amount = value(effect.amount);
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        drawCards(ctx, playerId, amount);
      }
      return;
    }
    case "discardFromHand": {
      const amount = value(effect.amount);
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        for (let i = 0; i < amount; i++) {
          const hand = mustPlayer(ctx.state, playerId).hand;
          if (hand.length === 0) break;
          const [index, rng] = nextInt(ctx.state.rng, hand.length);
          ctx.state = { ...ctx.state, rng };
          const picked = hand[index];
          if (picked) discardFromHand(ctx, playerId, picked);
        }
      }
      return;
    }
    case "revealTopOfEncounterDeck": {
      for (let i = 0; i < effect.count; i++) {
        const id = drawEncounterCard(ctx);
        if (!id) return;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        if (effect.then === "discard") moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
      }
      return;
    }
    case "exhaust":
      for (const id of targets(effect.target)) exhaustCard(ctx, id);
      return;
    case "ready":
      for (const id of targets(effect.target)) readyCard(ctx, id);
      return;
    case "giveStatus":
      for (const id of targets(effect.target)) giveStatus(ctx, id, effect.status);
      return;
    case "removeStatus":
      for (const id of targets(effect.target)) removeStatus(ctx, id, effect.status);
      return;
    case "addCounters": {
      const amount = value(effect.amount);
      for (const id of targets(effect.target)) addCounters(ctx, id, effect.counterType, amount);
      return;
    }
    case "removeCounters": {
      const amount = value(effect.amount);
      for (const id of targets(effect.target)) removeCounters(ctx, id, effect.counterType, amount);
      return;
    }
    case "attach": {
      const [host] = targets(effect.to);
      if (!host) return;
      for (const id of targets(effect.card)) {
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
      }
      return;
    }
    case "discardFromPlay":
      for (const id of targets(effect.target)) discardFromPlay(ctx, id);
      return;
    case "putIntoPlay": {
      const [controller] = resolvePlayers(ctx.state, effect.controller, context);
      if (!controller) return;
      const entering = targets(effect.card);
      for (const id of entering) {
        // A minion belongs to the encounter side even while it sits in a player's area.
        const isMinion = cardOf(ctx.state, id)?.type === "minion";
        moveCard(ctx, id, { kind: "playArea", playerId: controller });
        updateInstance(ctx, id, (instance) => ({
          ...instance,
          controllerId: isMinion ? null : controller,
          engagedWith: isMinion ? controller : instance.engagedWith,
          faceup: true,
        }));
        applyEnterPlayKeywords(ctx, id);
      }
      const entered: TriggerEvent[] = entering.map((id) => ({
        kind: "cardEntersPlay",
        instanceId: id,
        playerId: controller,
      }));
      for (const id of entering) {
        const quickstrike = quickstrikeAttack(ctx.state, id);
        if (quickstrike) entered.push(quickstrike);
      }
      pushEvents(ctx, entered);
      return;
    }
    case "dealEncounterCard":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        dealEncounterCardTo(ctx, playerId);
      }
      return;
    case "revealEncounterCard": {
      const frames: StackFrame[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const id = drawEncounterCard(ctx);
        if (id) frames.push(revealFrame(ctx, playerId, id));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "addAccelerationToken":
      addAccelerationToken(ctx);
      return;
    case "removeAccelerationToken":
      removeAccelerationToken(ctx);
      return;
    case "if": {
      const branch = evaluate(ctx.state, effect.condition, context)
        ? effect.then
        : (effect.otherwise ?? []);
      pushEffects(ctx, {
        effects: branch,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        bindings: frame.bindings,
      });
      return;
    }
    case "cancelTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) =>
        target.kind === "event" ? { ...target, cancelled: true } : target,
      );
      return;
    }
    case "chooseTarget":
      throw new EngineInvariantError("chooseTarget is handled before applyEffect");
  }
}

// ---------------------------------------------------------------------------
// Event application
// ---------------------------------------------------------------------------

function applyEvent(ctx: Ctx, event: TriggerEvent): void {
  switch (event.kind) {
    case "dealDamage":
      return applyDamage(ctx, event);
    case "healDamage":
      return healDamage(ctx, event.targetInstanceId, event.amount);
    case "placeThreat":
      return applyPlaceThreat(ctx, event);
    case "removeThreat":
      return applyRemoveThreat(ctx, event);
    case "attack":
      return applyPlayerAttack(ctx, event);
    case "thwart":
      return applyPlayerThwart(ctx, event);
    case "enemyAttack":
      return pushEnemyAttackFrame(ctx, event);
    case "enemyScheme":
      return pushEnemySchemeFrame(ctx, event);
    case "characterAttacked":
      return applyRetaliate(ctx, event);
    default:
      return;
  }
}

/**
 * RRG "Overkill": excess damage spills to the villain when the attack defeats a
 * minion, and to the controlling player's hero when an *ally used to defend*
 * is defeated — an ally hit by anything other than a defense does not spill.
 */
function overkillRecipient(state: GameState, targetId: InstanceId): InstanceId | null {
  const card = cardOf(state, targetId);
  if (card?.type === "minion") return state.villain.instanceId;
  if (card?.type !== "ally") return null;
  const defended = state.stack.some(
    (frame) => frame.kind === "enemyAttack" && frame.defenderInstanceId === targetId,
  );
  if (!defended) return null;
  const controller = controllerOf(state, targetId);
  return controller ? (getPlayer(state, controller)?.identity.instanceId ?? null) : null;
}

/** RRG "Tough": a tough status prevents all damage and is discarded instead. */
function applyDamage(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>): void {
  if (event.amount <= 0) return;
  const source = event.sourceInstanceId;
  const attackKeyword = (name: "piercing" | "overkill"): boolean =>
    event.fromAttack && source !== null && hasKeyword(ctx.state, source, name);

  if (attackKeyword("piercing")) pierceTough(ctx, event.targetInstanceId);

  const target = getInstance(ctx.state, event.targetInstanceId);
  if (!target) return;
  if (target.statuses.tough > 0) {
    updateInstance(ctx, event.targetInstanceId, (i) => ({
      ...i,
      statuses: { ...i.statuses, tough: i.statuses.tough - 1 },
    }));
    emit(ctx, { type: "damagePrevented", targetInstanceId: event.targetInstanceId, amount: event.amount, reason: "tough" });
    emit(ctx, {
      type: "statusRemoved",
      instanceId: event.targetInstanceId,
      status: "tough",
      reason: "preventedDamage",
    });
    return;
  }
  updateInstance(ctx, event.targetInstanceId, (i) => ({ ...i, damage: i.damage + event.amount }));
  emit(ctx, {
    type: "damageDealt",
    targetInstanceId: event.targetInstanceId,
    amount: event.amount,
    sourceInstanceId: event.sourceInstanceId,
  });

  const profile = characterProfile(ctx.state, event.targetInstanceId, ctx.deps);
  const damage = mustInstance(ctx.state, event.targetInstanceId).damage;
  const excess = attackKeyword("overkill") && profile ? damage - profile.maxHp : 0;
  const recipient = excess > 0 ? overkillRecipient(ctx.state, event.targetInstanceId) : null;

  checkDefeats(ctx);

  if (recipient && !ctx.state.outcome) {
    emit(ctx, { type: "overkillSpilled", fromInstanceId: event.targetInstanceId, toInstanceId: recipient, amount: excess });
    pushEvent(ctx, {
      kind: "dealDamage",
      targetInstanceId: recipient,
      amount: excess,
      sourceInstanceId: source,
      fromAttack: true,
    });
  }
}

/**
 * RRG "Retaliate X": a forced response after the character is attacked; it must
 * still be in play once the attack resolves. RRG "Ranged": an attack with ranged
 * ignores retaliate entirely.
 */
function applyRetaliate(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterAttacked" }>): void {
  if (hasKeyword(ctx.state, event.attackerInstanceId, "ranged")) return;
  const inPlay = cardsInPlay(ctx.state);
  if (!inPlay.includes(event.targetInstanceId) || !inPlay.includes(event.attackerInstanceId)) return;
  const amount = keywordTotal(ctx.state, event.targetInstanceId, "retaliate");
  if (amount <= 0) return;
  pushEvent(ctx, {
    kind: "dealDamage",
    targetInstanceId: event.attackerInstanceId,
    amount,
    sourceInstanceId: event.targetInstanceId,
    fromAttack: false,
  });
}

function applyPlaceThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "placeThreat" }>): void {
  if (event.amount <= 0) return;
  if (!getInstance(ctx.state, event.schemeInstanceId)) return;
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat + event.amount }));
  emit(ctx, {
    type: "threatPlaced",
    schemeInstanceId: event.schemeInstanceId,
    amount: event.amount,
    sourceInstanceId: event.sourceInstanceId,
  });
  if (event.schemeInstanceId === ctx.state.mainScheme.instanceId) checkMainSchemeCompletion(ctx);
}

function applyRemoveThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "removeThreat" }>): void {
  const scheme = getInstance(ctx.state, event.schemeInstanceId);
  if (!scheme) return;
  const removed = Math.min(event.amount, scheme.threat);
  if (removed <= 0) return;
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat - removed }));
  emit(ctx, {
    type: "threatRemoved",
    schemeInstanceId: event.schemeInstanceId,
    amount: removed,
    sourceInstanceId: event.sourceInstanceId,
  });
  const after = mustInstance(ctx.state, event.schemeInstanceId);
  const card = cardOf(ctx.state, event.schemeInstanceId);
  const isSideScheme = card?.type === "side_scheme" || card?.type === "player_side_scheme";
  if (isSideScheme && after.threat === 0) {
    emit(ctx, { type: "schemeDefeated", instanceId: event.schemeInstanceId, cardId: after.cardId });
    pushGameAbilities(ctx, event.schemeInstanceId, ["whenDefeated"], null);
    announce(ctx, { kind: "schemeDefeated", instanceId: event.schemeInstanceId });
    moveCard(ctx, event.schemeInstanceId, { kind: "encounterDiscard" }, "top");
  }
}

function applyPlayerAttack(ctx: Ctx, event: Extract<TriggerEvent, { kind: "attack" }>): void {
  const profile = characterProfile(ctx.state, event.attackerInstanceId, ctx.deps);
  if (!profile) return;
  if (!getInstance(ctx.state, event.targetInstanceId)) return;
  pushEvents(ctx, [
    {
      kind: "dealDamage",
      targetInstanceId: event.targetInstanceId,
      amount: profile.atk,
      sourceInstanceId: event.attackerInstanceId,
      fromAttack: true,
    },
    {
      kind: "characterAttacked",
      attackerInstanceId: event.attackerInstanceId,
      targetInstanceId: event.targetInstanceId,
      playerId: event.playerId,
    },
  ]);
}

function applyPlayerThwart(ctx: Ctx, event: Extract<TriggerEvent, { kind: "thwart" }>): void {
  const profile = characterProfile(ctx.state, event.thwarterInstanceId, ctx.deps);
  if (!profile) return;
  pushEvent(ctx, {
    kind: "removeThreat",
    schemeInstanceId: event.schemeInstanceId,
    amount: profile.thw,
    sourceInstanceId: event.thwarterInstanceId,
  });
}

// ---------------------------------------------------------------------------
// Enemy attack / scheme procedures
// ---------------------------------------------------------------------------

const getsBoostCard = (state: GameState, enemyId: InstanceId): boolean => {
  const card = cardOf(state, enemyId);
  if (!card) return false;
  if (card.type === "villain") return true;
  if (card.type === "minion") return card.keywords.some((k) => k.name === "villainous");
  return false;
};

const boostIconsOf = (card: AnyCard): number => ("boostIcons" in card ? card.boostIcons : 0);

function giveBoostCard(ctx: Ctx, enemyId: InstanceId): void {
  if (!getsBoostCard(ctx.state, enemyId)) return;
  const id = drawEncounterCard(ctx);
  if (!id) return;
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
  moveCard(ctx, id, { kind: "boost", hostInstanceId: enemyId });
  emit(ctx, { type: "boostCardDealt", enemyInstanceId: enemyId, instanceId: id });
}

/**
 * RRG "Boost": each boost card is flipped, its "Boost" ability resolves, and its
 * icons raise the enemy's ATK/SCH. The abilities go on the stack, so they resolve
 * before the activation's damage/threat step rather than interleaved per card.
 */
function flipBoostCards(ctx: Ctx, enemyId: InstanceId): number {
  let icons = 0;
  const frames: StackFrame[] = [];
  for (const boostId of [...mustInstance(ctx.state, enemyId).boostCards]) {
    updateInstance(ctx, boostId, (i) => ({ ...i, faceup: true }));
    const card = mustCardOf(ctx.state, boostId);
    const value = boostIconsOf(card);
    icons += value;
    emit(ctx, { type: "boostCardFlipped", enemyInstanceId: enemyId, instanceId: boostId, boostIcons: value });
    frames.push(...gameAbilityFrames(ctx, boostId, ["boost"], null));
    moveCard(ctx, boostId, { kind: "encounterDiscard" }, "top");
  }
  pushFrames(ctx, frames);
  return icons;
}

function pushEnemyAttackFrame(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyAttack" }>): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyAttack",
      enemyInstanceId: event.enemyInstanceId,
      attackedPlayerId: event.attackedPlayerId,
      targetPlayerId: event.targetPlayerId,
      targetInstanceId: event.targetInstanceId,
      defenderInstanceId: null,
      boostIcons: 0,
      stage: "giveBoost",
    },
  ]);
}

/**
 * RRG "Defend": any player may defend with a character they control, and if a
 * player other than the attacked player defends, that player becomes the new
 * target. The attacked player is the one who decides (co-op table convention;
 * the engine gives the decision to a single seat so it stays deterministic).
 */
export function legalDefenders(state: GameState, attackedPlayerId: PlayerId): readonly InstanceId[] {
  const defenders: InstanceId[] = [];
  for (const player of playerOrder(state)) {
    const identity = getInstance(state, player.identity.instanceId);
    if (identity && player.identity.form === "hero" && !identity.exhausted) {
      defenders.push(identity.instanceId);
    }
    for (const id of player.playArea) {
      if (cardOf(state, id)?.type !== "ally") continue;
      if (!mustInstance(state, id).exhausted) defenders.push(id);
    }
  }
  const attacked = mustPlayer(state, attackedPlayerId);
  const ownFirst = (id: InstanceId): number =>
    id === attacked.identity.instanceId || attacked.playArea.includes(id) ? 0 : 1;
  return [...defenders].sort((a, b) => ownFirst(a) - ownFirst(b));
}

function executeEnemyAttackFrame(ctx: Ctx, frame: Frame<"enemyAttack">): void {
  switch (frame.stage) {
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "declareDefender" });
      giveBoostCard(ctx, frame.enemyInstanceId);
      return;
    }
    case "declareDefender": {
      if (frame.answer) {
        const [picked] = frame.answer;
        if (!picked || picked === "decline") {
          emit(ctx, {
            type: "defenseDeclined",
            attackInstanceId: frame.enemyInstanceId,
            playerId: frame.attackedPlayerId,
          });
          setFrame(ctx, { ...frame, answer: null, stage: "flipBoosts" });
          return;
        }
        const defenderId = asInstanceId(picked);
        const defenderPlayer = controllerOf(ctx.state, defenderId) ?? frame.targetPlayerId;
        emit(ctx, {
          type: "defenderDeclared",
          attackInstanceId: frame.enemyInstanceId,
          defenderInstanceId: defenderId,
          playerId: frame.attackedPlayerId,
        });
        setFrame(ctx, {
          ...frame,
          answer: null,
          stage: "flipBoosts",
          defenderInstanceId: defenderId,
          targetInstanceId: defenderId,
          targetPlayerId: defenderPlayer,
        });
        exhaustCard(ctx, defenderId);
        return;
      }
      const defenders = legalDefenders(ctx.state, frame.attackedPlayerId);
      if (defenders.length === 0) {
        setFrame(ctx, { ...frame, stage: "flipBoosts" });
        return;
      }
      requestChoice(ctx, {
        playerId: frame.attackedPlayerId,
        prompt: {
          kind: "declareDefender",
          attack: {
            enemyInstanceId: frame.enemyInstanceId,
            targetPlayerId: frame.targetPlayerId,
            targetCharacterInstanceId: frame.targetInstanceId,
          },
        },
        options: [
          { optionId: "decline", label: "No defense", ref: { kind: "none" } },
          ...defenders.map((id) => ({
            optionId: id,
            label: mustCardOf(ctx.state, id).name,
            ref: { kind: "card", instanceId: id } as const,
          })),
        ],
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    case "flipBoosts": {
      const icons = flipBoostCards(ctx, frame.enemyInstanceId);
      setFrame(ctx, { ...frame, stage: "dealDamage", boostIcons: icons });
      return;
    }
    case "dealDamage": {
      setFrame(ctx, { ...frame, stage: "done" });
      const enemyProfile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!enemyProfile) return;
      const defenderProfile = frame.defenderInstanceId
        ? characterProfile(ctx.state, frame.defenderInstanceId, ctx.deps)
        : undefined;
      const reduction = defenderProfile?.kind === "identity" ? defenderProfile.def : 0;
      const damage = Math.max(0, enemyProfile.atk + frame.boostIcons - reduction);
      emit(ctx, {
        type: "attackResolved",
        enemyInstanceId: frame.enemyInstanceId,
        targetInstanceId: frame.targetInstanceId,
        baseAtk: enemyProfile.atk,
        boostIcons: frame.boostIcons,
        defenseReduction: reduction,
        damageDealt: damage,
      });
      pushEvents(ctx, [
        {
          kind: "dealDamage",
          targetInstanceId: frame.targetInstanceId,
          amount: damage,
          sourceInstanceId: frame.enemyInstanceId,
          fromAttack: true,
        },
        {
          kind: "characterAttacked",
          attackerInstanceId: frame.enemyInstanceId,
          targetInstanceId: frame.targetInstanceId,
          playerId: frame.attackedPlayerId,
        },
      ]);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

function pushEnemySchemeFrame(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyScheme" }>): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyScheme",
      enemyInstanceId: event.enemyInstanceId,
      playerId: event.playerId,
      boostIcons: 0,
      stage: "giveBoost",
    },
  ]);
}

function executeEnemySchemeFrame(ctx: Ctx, frame: Frame<"enemyScheme">): void {
  switch (frame.stage) {
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "flipBoosts" });
      giveBoostCard(ctx, frame.enemyInstanceId);
      return;
    }
    case "flipBoosts": {
      const icons = flipBoostCards(ctx, frame.enemyInstanceId);
      setFrame(ctx, { ...frame, stage: "placeThreat", boostIcons: icons });
      return;
    }
    case "placeThreat": {
      setFrame(ctx, { ...frame, stage: "done" });
      const profile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!profile) return;
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId: ctx.state.mainScheme.instanceId,
        amount: profile.sch + frame.boostIcons,
        sourceInstanceId: frame.enemyInstanceId,
      });
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

// ---------------------------------------------------------------------------
// Reveal
// ---------------------------------------------------------------------------

const revealFrame = (ctx: Ctx, playerId: PlayerId, id: InstanceId): StackFrame => ({
  ...base(ctx),
  kind: "reveal",
  instanceId: id,
  playerId,
  stage: "faceup",
});

export function pushRevealFrame(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  pushFrames(ctx, [revealFrame(ctx, playerId, id)]);
}

const attachmentQuery = (target: "hero" | "ally" | "any_character"): TargetQuery => {
  if (target === "hero") return { categories: ["hero"] };
  if (target === "ally") return { categories: ["ally"] };
  return { categories: ["hero", "alterEgo", "ally"] };
};

function executeRevealFrame(ctx: Ctx, frame: Frame<"reveal">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  switch (frame.stage) {
    case "faceup": {
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, faceup: true }));
      emit(ctx, {
        type: "encounterCardRevealed",
        instanceId: frame.instanceId,
        cardId: card.id,
        playerId: frame.playerId,
      });
      setFrame(ctx, { ...frame, stage: "enterPlay" });
      return;
    }
    case "enterPlay": {
      if (card.type === "attachment" && card.attachesTo !== "villain") {
        const resolved = resolveAttachmentTarget(ctx, frame, card.attachesTo);
        if (!resolved) return;
      } else {
        enterPlayOnReveal(ctx, frame.instanceId, frame.playerId);
      }
      setFrame(ctx, { ...frame, answer: null, stage: "whenRevealed" });
      return;
    }
    case "whenRevealed": {
      setFrame(ctx, { ...frame, stage: "finish" });
      const revealed: TriggerEvent = {
        kind: "cardRevealed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
      };
      const frames: StackFrame[] = [];
      // RRG "Incite X" is itself a "When Revealed: place X threat on the main scheme".
      const incite = keywordTotal(ctx.state, frame.instanceId, "incite");
      if (incite > 0) {
        frames.push(
          eventFrame(ctx, {
            kind: "placeThreat",
            schemeInstanceId: ctx.state.mainScheme.instanceId,
            amount: incite,
            sourceInstanceId: frame.instanceId,
          }),
        );
      }
      frames.push(...gameAbilityFrames(ctx, frame.instanceId, ["whenRevealed"], revealed));
      pushFrames(ctx, frames);
      return;
    }
    case "finish": {
      setFrame(ctx, { ...frame, stage: "done" });
      if (card.type === "treachery" && getInstance(ctx.state, frame.instanceId)) {
        moveCard(ctx, frame.instanceId, { kind: "encounterDiscard" }, "top");
      }
      // RRG "Reveal": responses to any step wait until every step has completed.
      const events: TriggerEvent[] = [
        { kind: "cardRevealed", instanceId: frame.instanceId, playerId: frame.playerId },
      ];
      // RRG "Quickstrike": resolves after this minion's "When Revealed" abilities.
      const quickstrike = quickstrikeAttack(ctx.state, frame.instanceId);
      if (quickstrike) events.push(quickstrike);
      const frames: StackFrame[] = events.map((event) => eventFrame(ctx, event));
      // RRG "Surge": the original card is fully resolved first, then the same
      // player reveals one more — so the extra reveal is queued last.
      if (hasKeyword(ctx.state, frame.instanceId, "surge")) {
        const next = dealEncounterCardTo(ctx, frame.playerId);
        if (next) {
          emit(ctx, { type: "surgeTriggered", instanceId: frame.instanceId, playerId: frame.playerId });
          frames.push(revealFrame(ctx, frame.playerId, next));
        }
      }
      pushFrames(ctx, frames);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

/**
 * The keywords that resolve as a card enters play: toughness places a tough
 * status card, uses places its all-purpose counters, and restricted makes the
 * controller check that they still control at most two restricted cards.
 */
export function applyEnterPlayKeywords(ctx: Ctx, id: InstanceId): void {
  for (const keyword of keywordsOf(ctx.state, id)) {
    if (keyword.name === "toughness") giveStatus(ctx, id, "tough");
    if (keyword.name === "uses") addCounters(ctx, id, keyword.counterType, keyword.count);
  }
  if (hasKeyword(ctx.state, id, "restricted")) checkRestricted(ctx, controllerOf(ctx.state, id));
}

/**
 * RRG "Restricted": playing a third is illegal (see `playCard`), but an effect
 * can still put one into play — then the controller discards down to two.
 */
function checkRestricted(ctx: Ctx, playerId: PlayerId | null): void {
  if (!playerId) return;
  const held = restrictedCardsOf(ctx.state, playerId);
  if (held.length <= 2) return;
  requestChoice(ctx, {
    playerId,
    prompt: { kind: "discardRestricted", limit: 2 },
    options: held.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: held.length - 2,
    maxSelections: held.length - 2,
  });
}

function enterPlay(ctx: Ctx, id: InstanceId, playerId: PlayerId | null): void {
  applyEnterPlayKeywords(ctx, id);
  announce(ctx, { kind: "cardEntersPlay", instanceId: id, playerId });
}

/** RRG "Quickstrike": after this minion engages a hero-form player, it attacks them. */
function quickstrikeAttack(state: GameState, id: InstanceId): TriggerEvent | null {
  if (cardOf(state, id)?.type !== "minion") return null;
  if (!hasKeyword(state, id, "quickstrike")) return null;
  const engagedWith = getInstance(state, id)?.engagedWith;
  if (!engagedWith) return null;
  const player = getPlayer(state, engagedWith);
  if (!player || player.identity.form !== "hero") return null;
  return {
    kind: "enemyAttack",
    enemyInstanceId: id,
    attackedPlayerId: player.playerId,
    targetPlayerId: player.playerId,
    targetInstanceId: player.identity.instanceId,
  };
}

export function enterPlayOnReveal(ctx: Ctx, id: InstanceId, playerId: PlayerId): void {
  const card = mustCardOf(ctx.state, id);
  let entered = false;
  switch (card.type) {
    case "minion":
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: playerId, controllerId: null }));
      entered = true;
      break;
    case "side_scheme":
      moveCard(ctx, id, { kind: "villainArea" });
      entered = true;
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId: id,
        amount: scale(card.startingThreat, ctx.state.startingPlayerCount),
        sourceInstanceId: null,
      });
      break;
    case "environment":
      moveCard(ctx, id, { kind: "villainArea" });
      entered = true;
      break;
    case "attachment":
      moveCard(ctx, id, { kind: "attachment", hostInstanceId: ctx.state.villain.instanceId });
      entered = true;
      break;
    case "obligation":
      moveCard(ctx, id, { kind: "playArea", playerId });
      entered = true;
      break;
    default:
      break;
  }
  if (entered) enterPlay(ctx, id, playerId);
}

/** Returns false while a target choice is pending. */
function resolveAttachmentTarget(
  ctx: Ctx,
  frame: Frame<"reveal">,
  attachesTo: "hero" | "ally" | "any_character" | "main_scheme" | "side_scheme",
): boolean {
  if (attachesTo === "main_scheme") {
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: ctx.state.mainScheme.instanceId });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  const query: TargetQuery =
    attachesTo === "side_scheme" ? { categories: ["sideScheme"] } : attachmentQuery(attachesTo);
  const context: EffectContext = {
    selfInstanceId: frame.instanceId,
    controllerId: frame.playerId,
    event: null,
    bindings: {},
  };
  const legal = selectTargets(ctx.state, query, context);
  if (legal.length === 0) {
    // RRG "Attach To": a card that cannot legally attach and cannot stay where it was is discarded.
    moveCard(ctx, frame.instanceId, { kind: "encounterDiscard" }, "top");
    return true;
  }
  if (frame.answer) {
    const [picked] = frame.answer;
    const host = picked ? asInstanceId(picked) : legal[0];
    if (!host) return true;
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  if (legal.length === 1) {
    const host = legal[0] as InstanceId;
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  requestChoice(ctx, {
    playerId: frame.playerId,
    prompt: { kind: "chooseAttachmentTarget", instanceId: frame.instanceId },
    options: legal.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
  return false;
}

// ---------------------------------------------------------------------------
// Playing a card
// ---------------------------------------------------------------------------

export function pushPlayCardFrame(
  ctx: Ctx,
  id: InstanceId,
  playerId: PlayerId,
  attachToInstanceId: InstanceId | null,
  triggered?: {
    readonly triggeredAbilityId: AbilityId;
    readonly event: TriggerEvent | null;
    readonly eventFrameId: FrameId | null;
  },
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "playCard",
      instanceId: id,
      playerId,
      attachToInstanceId,
      stage: "enterPlay",
      triggeredAbilityId: triggered?.triggeredAbilityId ?? null,
      event: triggered?.event ?? null,
      eventFrameId: triggered?.eventFrameId ?? null,
    },
  ]);
}

function executePlayCardFrame(ctx: Ctx, frame: Frame<"playCard">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  switch (frame.stage) {
    case "enterPlay": {
      setFrame(ctx, { ...frame, stage: "effects" });
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, controllerId: frame.playerId, faceup: true }));
      switch (card.type) {
        case "ally":
        case "support":
          moveCard(ctx, frame.instanceId, { kind: "playArea", playerId: frame.playerId });
          enterPlay(ctx, frame.instanceId, frame.playerId);
          break;
        case "upgrade": {
          const host = frame.attachToInstanceId ?? mustPlayer(ctx.state, frame.playerId).identity.instanceId;
          moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
          enterPlay(ctx, frame.instanceId, frame.playerId);
          break;
        }
        case "player_side_scheme":
          moveCard(ctx, frame.instanceId, { kind: "villainArea" });
          enterPlay(ctx, frame.instanceId, frame.playerId);
          pushEvent(ctx, {
            kind: "placeThreat",
            schemeInstanceId: frame.instanceId,
            amount: scale(card.startingThreat, ctx.state.startingPlayerCount),
            sourceInstanceId: null,
          });
          break;
        default:
          break;
      }
      return;
    }
    case "effects": {
      setFrame(ctx, { ...frame, stage: "discardEvent" });
      // RRG "Event": an event's effects resolve while it is out of play, then it is discarded.
      if (card.type !== "event") return;
      const frames: StackFrame[] = [];
      for (const ref of printedAbilityRefs(card)) {
        const definition = ctx.deps.abilities[ref.id];
        if (!definition) continue;
        // An event played inside a timing window resolves only the ability that
        // matched that window, and it keeps the triggering event's context so a
        // "cancel" effect knows what it is cancelling.
        const wanted = frame.triggeredAbilityId
          ? ref.id === frame.triggeredAbilityId
          : definition.trigger.kind === "action";
        if (!wanted) continue;
        frames.push(
          abilityFrame(
            ctx,
            {
              instanceId: frame.instanceId,
              abilityId: ref.id,
              controllerId: frame.playerId,
              forced: true,
              fromHand: false,
            },
            frame.event,
            frame.eventFrameId,
          ),
        );
      }
      pushFrames(ctx, frames);
      return;
    }
    case "discardEvent": {
      setFrame(ctx, { ...frame, stage: "done" });
      if (card.type === "event" && getInstance(ctx.state, frame.instanceId)) {
        moveCard(ctx, frame.instanceId, { kind: "discard", playerId: frame.playerId }, "top");
      }
      announce(ctx, { kind: "cardPlayed", instanceId: frame.instanceId, playerId: frame.playerId });
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

// ---------------------------------------------------------------------------
// Defeat, elimination, stage advancement
// ---------------------------------------------------------------------------

function checkMainSchemeCompletion(ctx: Ctx): void {
  const scheme = mustInstance(ctx.state, ctx.state.mainScheme.instanceId);
  const stage = mainSchemeStage(ctx.state);
  const target = scale(stage.targetThreat, ctx.state.startingPlayerCount);
  if (scheme.threat < target) return;

  emit(ctx, { type: "mainSchemeCompleted", stageIndex: ctx.state.mainScheme.stageIndex });
  const nextIndex = ctx.state.mainScheme.stageIndex + 1;
  if (nextIndex >= mainSchemeStageCount(ctx.state)) {
    ctx.state = { ...ctx.state, mainScheme: { ...ctx.state.mainScheme, completed: true } };
    endGame(ctx, { result: "loss", reason: "mainSchemeCompleted" });
    return;
  }
  advanceMainScheme(ctx, nextIndex);
}

/** RRG "Main Scheme": excess threat does not carry over; acceleration tokens do. */
function advanceMainScheme(ctx: Ctx, nextIndex: number): void {
  ctx.state = { ...ctx.state, mainScheme: { ...ctx.state.mainScheme, stageIndex: nextIndex } };
  const stage = mainSchemeStage(ctx.state);
  updateInstance(ctx, ctx.state.mainScheme.instanceId, (i) => ({ ...i, threat: 0 }));
  emit(ctx, { type: "mainSchemeAdvanced", stageIndex: nextIndex });
  pushEvent(ctx, {
    kind: "placeThreat",
    schemeInstanceId: ctx.state.mainScheme.instanceId,
    amount: scale(stage.startingThreat, ctx.state.startingPlayerCount),
    sourceInstanceId: null,
  });
  announce(ctx, { kind: "mainSchemeAdvanced", stageIndex: nextIndex });
}

/** Sweeps every character in play for zero remaining hit points, in a fixed order. */
export function checkDefeats(ctx: Ctx): void {
  if (ctx.state.outcome) return;

  const villainId = ctx.state.villain.instanceId;
  const villainProfile = characterProfile(ctx.state, villainId, ctx.deps);
  const villain = getInstance(ctx.state, villainId);
  if (villainProfile && villain && villain.damage >= villainProfile.maxHp) {
    defeatVillainStage(ctx);
    if (ctx.state.outcome) return;
  }

  // One batch for the whole sweep so the first character defeated is also the
  // first whose "When Defeated" abilities resolve.
  const defeatFrames: StackFrame[] = [];
  for (const player of playerOrder(ctx.state)) {
    for (const id of [...player.playArea]) {
      const profile = characterProfile(ctx.state, id, ctx.deps);
      const instance = getInstance(ctx.state, id);
      if (!profile || !instance) continue;
      if (profile.kind !== "ally" && profile.kind !== "minion") continue;
      if (instance.damage < profile.maxHp) continue;
      if (hasKeyword(ctx.state, id, "permanent")) continue;
      emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
      const to: ZoneId =
        profile.kind === "ally" && instance.ownerId
          ? { kind: "discard", playerId: instance.ownerId }
          : { kind: "encounterDiscard" };
      moveCard(ctx, id, to, "top");
      const defeated: TriggerEvent = { kind: "characterDefeated", instanceId: id };
      defeatFrames.push(...gameAbilityFrames(ctx, id, ["whenDefeated"], defeated));
      defeatFrames.push(eventFrame(ctx, defeated));
    }
  }
  pushFrames(ctx, defeatFrames);

  for (const player of playerOrder(ctx.state)) {
    const identityId = player.identity.instanceId;
    const profile = characterProfile(ctx.state, identityId, ctx.deps);
    const instance = getInstance(ctx.state, identityId);
    if (!profile || !instance) continue;
    if (instance.damage < profile.maxHp) continue;
    eliminatePlayer(ctx, player.playerId);
    if (ctx.state.outcome) return;
  }
}

function defeatVillainStage(ctx: Ctx): void {
  const nextIndex = ctx.state.villain.stageIndex + 1;
  if (nextIndex >= villainStageCount(ctx.state)) {
    ctx.state = { ...ctx.state, villain: { ...ctx.state.villain, defeated: true } };
    emit(ctx, {
      type: "characterDefeated",
      instanceId: ctx.state.villain.instanceId,
      cardId: ctx.state.villain.cardId,
    });
    endGame(ctx, { result: "win", reason: "villainDefeated" });
    return;
  }
  // RRG "Villain Defeat": excess damage does not carry over to the new stage.
  ctx.state = { ...ctx.state, villain: { ...ctx.state.villain, stageIndex: nextIndex } };
  updateInstance(ctx, ctx.state.villain.instanceId, (i) => ({ ...i, damage: 0 }));
  emit(ctx, { type: "villainStageAdvanced", stageIndex: nextIndex });
  announce(ctx, { kind: "villainStageAdvanced", stageIndex: nextIndex });
}

/** RRG "Player Elimination" steps 1–5, minus permanent-keyword handling. */
export function eliminatePlayer(ctx: Ctx, playerId: PlayerId): void {
  const player = mustPlayer(ctx.state, playerId);
  if (player.eliminated) return;

  if (ctx.state.firstPlayerId === playerId) {
    const next = nextClockwisePlayer(ctx.state, playerId);
    if (next) {
      ctx.state = { ...ctx.state, firstPlayerId: next.playerId };
      emit(ctx, { type: "firstPlayerChanged", playerId: next.playerId });
    }
  }

  const nextSeat = nextClockwisePlayer(ctx.state, playerId);
  for (const id of [...player.playArea]) {
    // RRG "Permanent": a permanent card cannot leave play, elimination included.
    if (hasKeyword(ctx.state, id, "permanent")) continue;
    const card = cardOf(ctx.state, id);
    if (card?.type === "minion" && nextSeat) {
      moveCard(ctx, id, { kind: "playArea", playerId: nextSeat.playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: nextSeat.playerId }));
      continue;
    }
    const owner = getInstance(ctx.state, id)?.ownerId;
    moveCard(ctx, id, owner ? { kind: "discard", playerId: owner } : { kind: "encounterDiscard" }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).hand]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).deck]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }
  for (const id of [...mustPlayer(ctx.state, playerId).dealtEncounter]) {
    moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
  }

  updatePlayer(ctx, playerId, (p) => ({ ...p, eliminated: true }));
  emit(ctx, { type: "playerEliminated", playerId });

  if (ctx.state.players.every((p) => p.eliminated)) {
    endGame(ctx, { result: "loss", reason: "allPlayersDefeated" });
  }
}
