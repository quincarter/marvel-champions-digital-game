import type { AbilityId, AbilityReference, AnyCard, AttachmentHost } from "@mc/content";
import { abilityUseKey, type AbilityDefinition, type EngineDeps, type EventPattern } from "./abilities.js";
import {
  commitPlay,
  eventActionAbility,
  isPriceFault,
  paymentOptions,
  paymentsFromOptionIds,
  payCost,
  payPayment,
  planCost,
  pricePlay,
  priceOrNull,
} from "./actions.js";
import type { ChoiceOption } from "./choices.js";
import {
  emit,
  findFrame,
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
  addLastingEffect,
  costReductionFor,
  expireEventLastingEffects,
  dealEncounterCardTo,
  discardFromHand,
  discardFromPlay,
  drawCards,
  drawEncounterCard,
  endGame,
  exhaustCard,
  giveStatus,
  healDamage,
  leavePlay,
  pierceTough,
  setForm,
  takeTopOfDeck,
  shuffleZone,
  readyCard,
  removeAccelerationToken,
  removeCounters,
  removeStatus,
} from "./effects.js";
import { EngineInvariantError } from "./errors.js";
import { instanceId as asInstanceId, type FrameId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword, keywordTotal, keywordsOf, statusActive } from "./keywords.js";
import {
  cardOf,
  characterProfile,
  countSchemeIcons,
  getInstance,
  getPlayer,
  mainSchemeStage,
  mainSchemeStageCount,
  mustCardOf,
  mustInstance,
  isMinion,
  mustPlayer,
  nextClockwisePlayer,
  playerOrder,
  scale,
  villainStageCount,
} from "./query.js";
import { nextInt } from "./rng.js";
import {
  activeAbilityRefs,
  canAttack,
  cardsInPlay,
  categoriesOf,
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
import type { CardDestination, CardSelector, EffectSpec, TargetQuery } from "./spec.js";
import { addPools, combineRequirements, EMPTY_POOL, poolTotal, printedResources, requirementTotal, satisfies } from "./resources.js";
import { allyLimitFor, cannotTakeDamage, mustDefendWithAlly, threatCannotBeRemoved } from "./rules.js";
import {
  candidateOf,
  currentActivationFrameId,
  type Bindings,
  type DeferredEffects,
  type ReportTarget,
  type Vars,
  type StackFrame,
  type TriggerCandidate,
  type WindowTiming,
} from "./stack.js";
import type { Form, GameState, ZoneId } from "./state.js";
import type { LastingDuration, LastingScope } from "./lasting.js";
import { eventSubjects, isAnnouncement, type TriggerEvent } from "./trigger-events.js";

// ---------------------------------------------------------------------------
// Frame construction
// ---------------------------------------------------------------------------

const base = (ctx: Ctx) => ({ frameId: nextFrameId(ctx), answer: null }) as const;

const eventFrame = (ctx: Ctx, event: TriggerEvent, reportTo: ReportTarget | null = null): StackFrame => ({
  ...base(ctx),
  kind: "event",
  event,
  stage: isAnnouncement(event) ? "responses" : "interrupts",
  cancelled: false,
  vars: {},
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

const withResults = (event: TriggerEvent, vars: Vars): TriggerEvent =>
  Object.keys(vars).length === 0 ? event : { ...event, results: vars };

/** An event frame is finishing: hand its results (and whether it happened) to whoever asked for them. */
function reportResults(ctx: Ctx, frame: Frame<"event">, happened: boolean): void {
  if (!frame.reportTo) return;
  const { frameId, prefix } = frame.reportTo;
  const delta: Record<string, number> = { [`${prefix}.made`]: happened ? 1 : 0 };
  if (happened) for (const [key, amount] of Object.entries(frame.vars)) delta[`${prefix}.${key}`] = amount;
  addFrameVars(ctx, frameId, delta);
  if (happened) {
    const slots: Record<string, readonly InstanceId[]> = {};
    for (const [key, ids] of Object.entries(frame.slots)) slots[`${prefix}.${key}`] = ids;
    addFrameSlots(ctx, frameId, slots);
  }
}

/**
 * Several events at once, in the order they were listed: `events[0]` resolves
 * first. `pushFrames` prepends, so anything that queues per-target events in a
 * loop has to build the whole batch before pushing or it resolves backwards.
 */
export function pushEvents(ctx: Ctx, events: readonly TriggerEvent[], reportTo: ReportTarget | null = null): void {
  pushFrames(
    ctx,
    events.map((event) => eventFrame(ctx, event, reportTo)),
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

function abilityFrame(
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
    vars,
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
  if (!card) return [];
  // Villains, main schemes and identities print abilities for every face/stage;
  // only the active one is live.
  const refs =
    refsOverride ??
    (card.type === "villain" || card.type === "main_scheme" || card.type === "hero_identity"
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

// ---------------------------------------------------------------------------
// Trigger matching
// ---------------------------------------------------------------------------

function matchesPattern(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
  deps: EngineDeps,
): boolean {
  const kinds: readonly TriggerEvent["kind"][] = typeof pattern.on === "string" ? [pattern.on] : pattern.on;
  if (!kinds.includes(event.kind)) return false;
  // The same attack resolved against another player doesn't re-trigger the attacker's own "when it attacks".
  if (event.kind === "enemyAttack" && event.additionalResolution && event.enemyInstanceId === selfId) return false;
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
    // An encounter card has no controller: its "you" is the player the event is about.
    if (!controller) return actingPlayerOf(event, pattern) !== null && matchesRest(state, pattern, event, selfId, null, deps);
    // RRG p.9: "after [enemy] attacks you" resolves for the attacked player, not the defender.
    const attackedPlayer =
      pattern.usesAttackedPlayer && event.kind === "enemyAttack" ? event.attackedPlayerId : null;
    if (attackedPlayer !== null) {
      if (controller !== attackedPlayer) return false;
    } else if (!subjects.players.includes(controller)) {
      return false;
    }
  }
  return matchesRest(state, pattern, event, selfId, controller, deps);
}

/** Pattern checks that don't depend on who "you" is. */
function matchesRest(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
  controller: PlayerId | null,
  deps: EngineDeps,
): boolean {
  const subjects = eventSubjects(event);
  if (pattern.fromAttack !== undefined) {
    if (event.kind !== "dealDamage" || event.fromAttack !== pattern.fromAttack) return false;
  }
  const context: EffectContext = { selfInstanceId: selfId, controllerId: controller, event, bindings: {}, deps };
  if (pattern.targetIs) {
    const query: TargetQuery = pattern.targetIs;
    if (!subjects.targets.some((target) => matchesQuery(state, target, query, context))) return false;
  }
  if (pattern.sourceIs) {
    const query: TargetQuery = pattern.sourceIs;
    if (!subjects.sources.some((source) => matchesQuery(state, source, query, context))) return false;
  }
  if (pattern.requireResults) {
    for (const [key, amount] of Object.entries(pattern.requireResults)) {
      if ((event.results?.[key] ?? 0) < amount) return false;
    }
  }
  if (pattern.attackKind) {
    if (event.kind !== "attack" && event.kind !== "thwart") return false;
    if ((pattern.attackKind === "basic") !== (event.basic === true)) return false;
  }
  return true;
}

/** Who "you" is when an encounter card's ability triggers on an event. */
function actingPlayerOf(event: TriggerEvent, pattern: EventPattern): PlayerId | null {
  if (pattern.usesAttackedPlayer && event.kind === "enemyAttack") return event.attackedPlayerId;
  return eventSubjects(event).players[0] ?? null;
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
      if (!matchesPattern(state, trigger.on, event, id, deps)) continue;
      // RRG "Cost": an ability whose cost can't be paid can't be triggered.
      if (definition.cost && controllerId && isPriceFault(planCost(state, deps, id, controllerId, definition.cost, {}, new Set()))) {
        continue;
      }
      const acting = controllerId ?? actingPlayerOf(event, trigger.on);
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId: acting, definition }, forced));
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
        if (!matchesPattern(state, trigger.on, event, id, deps)) continue;
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
        reportResults(ctx, frame, false);
        expireEventLastingEffects(ctx, frame.frameId);
        popFrame(ctx);
        return;
      }
      setFrame(ctx, { ...frame, stage: "responses" });
      if (applyEvent(ctx, frame) === false) {
        // The event found nothing to do (a defeat whose character was healed first):
        // it didn't happen, so nothing responds to it.
        updateFrame(ctx, frame.frameId, (f) => (f.kind === "event" ? { ...f, stage: "done" } : f));
      }
      return;
    }
    case "responses": {
      // Results are final once everything the event pushed has resolved.
      const event = withResults(frame.event, frame.vars);
      emit(ctx, { type: "triggerEvent", event, phase: "resolved" });
      setFrame(ctx, { ...frame, event, stage: "done" });
      if (hasCandidates(ctx.state, ctx.deps, event, "response")) {
        pushWindow(ctx, event, "response", frame.frameId);
      }
      return;
    }
    case "done": {
      if (frame.endEffects.length > 0) {
        // "At the end of this attack": run after the response window, before the event is gone.
        setFrame(ctx, { ...frame, endEffects: [] });
        const event = withResults(frame.event, frame.vars);
        for (const deferred of [...frame.endEffects].reverse()) {
          pushEffects(ctx, { ...deferred, event, eventFrameId: null });
        }
        return;
      }
      reportResults(ctx, frame, true);
      expireEventLastingEffects(ctx, frame.frameId);
      popFrame(ctx);
      return;
    }
  }
}

/** RRG "Ability — Simultaneous Timing Priority": forced abilities before non-forced. */
const TIERS: readonly boolean[] = [true, false];

function executeWindowFrame(ctx: Ctx, frame: Frame<"window">): void {
  if (frame.answer) return absorbWindowAnswer(ctx, frame, frame.answer);
  // RRG "Interrupt": once an interrupt cancels or replaces the imminent event,
  // no further interrupts to it can be triggered.
  const eventFrame = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
  if (frame.timing === "interrupt" && eventFrame?.kind === "event" && eventFrame.cancelled) {
    popFrame(ctx);
    return;
  }
  if (frame.askingPlayerIds.length > 0) return askNextController(ctx, frame);
  if (frame.queue.length > 0) {
    const [next, ...rest] = frame.queue;
    if (!next) throw new EngineInvariantError("empty trigger queue");
    if (next.fromHand) return requestWindowPayment(ctx, frame, next, rest);
    return triggerCandidate(ctx, { ...frame, queue: rest }, next);
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

/** Resources needed to play an in-hand event inside a window (printed cost less reductions, plus its ability's cost). */
function windowEventCost(ctx: Ctx, candidate: TriggerCandidate): number {
  const card = cardOf(ctx.state, candidate.instanceId);
  if (!card || !candidate.controllerId) return 0;
  const printed = "cost" in card ? card.cost : 0;
  const reduced = Math.max(0, printed - costReductionFor(ctx.state, candidate.controllerId));
  const abilityCost = ctx.deps.abilities[candidate.abilityId]?.cost?.resources;
  return requirementTotal(combineRequirements(reduced, abilityCost));
}

/**
 * Resolves the next queued candidate, paying its cost first (RRG "Cost"). A
 * cost that can no longer be paid means the ability doesn't resolve; a cost
 * with resources asks the controller to pay (and they may decline).
 */
function triggerCandidate(ctx: Ctx, frame: Frame<"window">, candidate: TriggerCandidate): void {
  setFrame(ctx, frame);
  const definition = ctx.deps.abilities[candidate.abilityId];
  const controller = candidate.controllerId;
  if (!definition?.cost || !controller) {
    pushFrames(ctx, [abilityFrame(ctx, candidate, frame.event, frame.eventFrameId)]);
    return;
  }
  const plan = planCost(ctx.state, ctx.deps, candidate.instanceId, controller, definition.cost, {}, new Set());
  if (isPriceFault(plan)) return;
  const needed = requirementTotal(plan.requirement);
  if (needed > 0) {
    const options = paymentOptions(ctx, controller, null);
    setFrame(ctx, { ...frame, awaiting: "pay", paying: candidate });
    requestChoice(ctx, {
      playerId: controller,
      prompt: { kind: "payForAbility", instanceId: candidate.instanceId, abilityId: candidate.abilityId, cost: needed },
      options,
      minSelections: 0,
      maxSelections: options.length,
      frameId: frame.frameId,
    });
    return;
  }
  pushFrames(ctx, [abilityFrame(ctx, candidate, frame.event, frame.eventFrameId, plan.bindings, plan.vars)]);
  payCost(ctx, candidate.instanceId, controller, definition.cost, plan);
}

/** The answer to a `payForAbility` choice: pay and resolve, or decline by under-paying. */
function payWindowAbility(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  const candidate = frame.paying;
  setFrame(ctx, { ...frame, answer: null, awaiting: null, paying: null });
  const controller = candidate?.controllerId;
  const definition = candidate ? ctx.deps.abilities[candidate.abilityId] : undefined;
  if (!candidate || !controller || !definition) return;
  const payment = paymentsFromOptionIds(answer);
  const plan = planCost(ctx.state, ctx.deps, candidate.instanceId, controller, definition.cost, {}, new Set());
  if (isPriceFault(plan)) return;
  const pool = priceOrNull(ctx, controller, payment, null, plan.payingFor);
  if (!pool || !satisfies(pool, plan.requirement)) return;
  payPayment(ctx, controller, payment);
  const paidVars: Vars = {
    "paid.physical": pool.physical,
    "paid.mental": pool.mental,
    "paid.energy": pool.energy,
    "paid.wild": pool.wild,
    "paid.total": poolTotal(pool),
  };
  pushFrames(ctx, [
    abilityFrame(ctx, candidate, frame.event, frame.eventFrameId, plan.bindings, { ...plan.vars, ...paidVars }),
  ]);
  payCost(ctx, candidate.instanceId, controller, definition.cost, plan);
}

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
      cost: windowEventCost(ctx, candidate),
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
  const abilityCost = ctx.deps.abilities[candidate.abilityId]?.cost;
  const priced = pricePlay(ctx, controller, candidate.instanceId, abilityCost, payment, {});
  if (isPriceFault(priced)) return;
  commitPlay(ctx, controller, candidate.instanceId, payment, priced);
  pushPlayCardFrame(
    ctx,
    candidate.instanceId,
    controller,
    null,
    { triggeredAbilityId: candidate.abilityId, event: frame.event, eventFrameId: frame.eventFrameId },
    { bindings: priced.plan.bindings, vars: priced.vars },
  );
  payCost(ctx, candidate.instanceId, controller, abilityCost, priced.plan);
}

function absorbWindowAnswer(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  if (frame.awaiting === "pay") {
    return frame.paying?.fromHand === false ? payWindowAbility(ctx, frame, answer) : playWindowEvent(ctx, frame, answer);
  }
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
  if (definition.label && frame.controllerId && labelCancels(ctx, frame.controllerId, definition.label)) return;
  if (definition.label?.includes("defense") && frame.controllerId) declareLabeledDefense(ctx, frame.controllerId);
  pushEffects(ctx, {
    effects: definition.effects,
    selfInstanceId: frame.instanceId,
    controllerId: frame.controllerId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
    bindings: frame.bindings,
    vars: frame.vars,
  });
}

/**
 * RRG "Labeled Ability": a stunned identity using an (attack) ability, or a
 * confused one using a (thwart) ability, cancels the whole ability except its
 * costs, and every status that cancelled it is removed.
 */
function labelCancels(ctx: Ctx, playerId: PlayerId, labels: readonly string[]): boolean {
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  const cancelling: ("stunned" | "confused")[] = [];
  if (labels.includes("attack") && statusActive(ctx.state, identity, "stunned", ctx.deps)) cancelling.push("stunned");
  if (labels.includes("thwart") && statusActive(ctx.state, identity, "confused", ctx.deps)) cancelling.push("confused");
  for (const status of cancelling) {
    updateInstance(ctx, identity, (i) => ({ ...i, statuses: { ...i.statuses, [status]: 0 } }));
    emit(ctx, {
      type: "statusRemoved",
      instanceId: identity,
      status,
      reason: status === "stunned" ? "cancelledAttack" : "cancelledSchemeOrThwart",
    });
  }
  return cancelling.length > 0;
}

/** RRG "Defend, Defense": a (defense) ability makes the identity the defender if the current attack has none. */
function declareLabeledDefense(ctx: Ctx, playerId: PlayerId): void {
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  const attack = ctx.state.stack.find((f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack");
  if (attack) {
    if (attack.defenderInstanceId === null) setDefender(ctx, attack, identity, playerId, false);
    return;
  }
  // Interrupting the attack itself ("When the villain attacks you"): the procedure
  // hasn't started, so record the defender on the attack event.
  const activation = currentActivationFrameId(ctx.state.stack);
  const frame = activation ? ctx.state.stack.find((f) => f.frameId === activation) : undefined;
  if (frame?.kind !== "event" || frame.event.kind !== "enemyAttack" || (frame.vars.labeledDefense ?? 0) > 0) return;
  const enemyInstanceId = frame.event.enemyInstanceId;
  setFrame(ctx, {
    ...frame,
    event: { ...frame.event, targetInstanceId: identity, targetPlayerId: playerId },
    vars: { ...frame.vars, labeledDefense: 1 },
  });
  announce(ctx, { kind: "defended", defenderInstanceId: identity, enemyInstanceId, playerId, basic: false });
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

const contextOf = (frame: Frame<"effects">, deps: EngineDeps): EffectContext => ({
  deps,
  scopedPlayerId: frame.scopedPlayerId,
  selfInstanceId: frame.selfInstanceId,
  controllerId: frame.controllerId,
  event: frame.event,
  bindings: frame.bindings,
  vars: frame.vars,
});

function executeEffectsFrame(ctx: Ctx, frame: Frame<"effects">): void {
  const effect = frame.effects[frame.cursor];
  if (!effect) {
    popFrame(ctx);
    return;
  }
  const context = contextOf(frame, ctx.deps);

  if (effect.kind === "chooseCards") return executeChooseCards(ctx, frame, effect, context);
  if (effect.kind === "chooseOne") return executeChooseOne(ctx, frame, effect, context);
  if (effect.kind === "choosePlayer") return executeChoosePlayer(ctx, frame, effect, context);
  if (effect.kind === "resolveSpecials") return executeResolveSpecials(ctx, frame, effect, context);
  if (effect.kind === "assignDamage") return executeAssignDamage(ctx, frame, effect, context);
  if (effect.kind === "spendResources") return executeSpendResources(ctx, frame, effect, context);

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

/** The cards a selector names right now (out of play included), in zone order. */
export function selectCards(ctx: Ctx, selector: CardSelector, context: EffectContext): readonly InstanceId[] {
  const state = ctx.state;
  const filtered = (ids: readonly InstanceId[], filter: TargetQuery | undefined): readonly InstanceId[] =>
    filter ? ids.filter((id) => matchesQuery(state, id, filter, context)) : ids;
  switch (selector.kind) {
    case "ref":
      return filtered(resolveRef(state, selector.ref, context).filter((id) => getInstance(state, id) !== undefined), selector.filter);
    case "encounter": {
      let deck = state.encounterDeck;
      if (selector.top) deck = deck.slice(0, Math.max(0, resolveValue(state, selector.top, context)));
      const ids = [...(selector.zones.includes("deck") ? deck : []), ...(selector.zones.includes("discard") ? state.encounterDiscard : [])];
      return filtered(ids, selector.filter);
    }
    case "setAside":
      return resolvePlayers(state, selector.player, context).flatMap((playerId) => filtered(mustPlayer(state, playerId).setAside, selector.filter));
    case "tucked":
      return resolveRef(state, selector.under, context).flatMap((id) => getInstance(state, id)?.tucked ?? []);
    case "zone": {
      const found: InstanceId[] = [];
      for (const playerId of resolvePlayers(state, selector.player, context)) {
        const player = mustPlayer(state, playerId);
        let zone = selector.zone === "hand" ? player.hand : selector.zone === "deck" ? player.deck : player.discard;
        if (selector.top) zone = zone.slice(0, Math.max(0, resolveValue(state, selector.top, context)));
        let matching = [...filtered(zone, selector.filter)];
        if (selector.random) {
          // Random picks draw on the game's seeded RNG, so a replay picks the same cards.
          const count = Math.max(0, resolveValue(ctx.state, selector.random, context));
          const picked: InstanceId[] = [];
          for (let i = 0; i < count && matching.length > 0; i++) {
            const [index, rng] = nextInt(ctx.state.rng, matching.length);
            ctx.state = { ...ctx.state, rng };
            picked.push(matching[index] as InstanceId);
            matching.splice(index, 1);
          }
          matching = picked;
        }
        found.push(...(selector.topmostOnly ? matching.slice(0, 1) : matching));
      }
      return found;
    }
  }
}

/** `moveCards`: out-of-play cards move directly; cards in play leave play (attachments discarded, state cleared). */
function moveCardsTo(ctx: Ctx, ids: readonly InstanceId[], destination: CardDestination): void {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const shuffleOwners = new Set<PlayerId>();
  let shuffleEncounter = false;
  for (const id of ids) {
    const instance = getInstance(ctx.state, id);
    if (!instance) continue;
    const owner = instance.ownerId;
    let to: ZoneId;
    let position: "top" | "bottom" = "top";
    switch (destination) {
      case "hand":
        if (!owner) continue;
        to = { kind: "hand", playerId: owner };
        position = "bottom";
        break;
      case "discard":
        to = owner ? { kind: "discard", playerId: owner } : { kind: "encounterDiscard" };
        break;
      case "deckTop":
      case "deckBottom":
      case "deckShuffle":
        if (!owner) continue;
        to = { kind: "deck", playerId: owner };
        position = destination === "deckTop" ? "top" : "bottom";
        if (destination === "deckShuffle") shuffleOwners.add(owner);
        break;
      case "removedFromGame":
        to = { kind: "removedFromGame" };
        break;
      case "encounterDeckShuffle":
        if (owner) continue;
        to = { kind: "encounterDeck" };
        shuffleEncounter = true;
        break;
    }
    if (inPlay.has(id)) leavePlay(ctx, id, to, position, destination === "discard");
    else moveCard(ctx, id, to, position);
    if (destination !== "discard" && destination !== "removedFromGame") {
      updateInstance(ctx, id, (i) => ({ ...i, faceup: destination === "hand" ? i.faceup : false }));
    }
  }
  for (const owner of shuffleOwners) {
    const order = shuffleZone(ctx, { kind: "deck", playerId: owner }, mustPlayer(ctx.state, owner).deck);
    updatePlayer(ctx, owner, (p) => ({ ...p, deck: order }));
  }
  if (shuffleEncounter) shuffleEncounterDeck(ctx);
}

function shuffleEncounterDeck(ctx: Ctx): void {
  const order = shuffleZone(ctx, { kind: "encounterDeck" }, ctx.state.encounterDeck);
  ctx.state = { ...ctx.state, encounterDeck: order };
}

const cardOptions = (ctx: Ctx, ids: readonly InstanceId[]): readonly ChoiceOption[] =>
  ids.map((id) => ({ optionId: id, label: mustCardOf(ctx.state, id).name, ref: { kind: "card", instanceId: id } as const }));

function executeChooseCards(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseCards" }>,
  context: EffectContext,
): void {
  if (frame.answer !== null) {
    const chosen = frame.answer.map((id) => asInstanceId(id));
    emit(ctx, { type: "targetChosen", slot: effect.slot, instanceIds: chosen });
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: chosen } });
    return;
  }
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  let candidates = selectCards(ctx, effect.from, context);
  if (effect.distinctNames) {
    const seen = new Set<string>();
    candidates = candidates.filter((id) => {
      const name = cardOf(ctx.state, id)?.name ?? id;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }
  const max = Math.min(effect.max, candidates.length);
  if (!chooser || max === 0) {
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  requestChoice(ctx, {
    playerId: chooser,
    prompt: { kind: "chooseCards", slot: effect.slot },
    // "Different cards" by name: the offered ids are one per name, so any selection is legal.
    options: cardOptions(ctx, candidates),
    minSelections: Math.min(effect.min, max),
    maxSelections: max,
    frameId: frame.frameId,
  });
}

function executeChooseOne(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "chooseOne" }>,
  context: EffectContext,
): void {
  const available = effect.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.condition || evaluate(ctx.state, option.condition, context));
  const pickedIndex =
    frame.answer !== null ? Number(frame.answer[0]) : available.length === 1 ? (available[0]?.index ?? -1) : null;
  if (pickedIndex === null) {
    const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
    if (!chooser || available.length === 0) {
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      return;
    }
    requestChoice(ctx, {
      playerId: chooser,
      prompt: { kind: "chooseOption" },
      options: available.map(({ option, index }) => ({ optionId: String(index), label: option.label, ref: { kind: "none" } as const })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  const chosen = effect.options[pickedIndex];
  if (!chosen) return;
  emit(ctx, { type: "optionChosen", label: chosen.label, index: pickedIndex });
  pushEffects(ctx, {
    effects: chosen.effects,
    selfInstanceId: frame.selfInstanceId,
    controllerId: frame.controllerId,
    event: frame.event,
    eventFrameId: frame.eventFrameId,
    bindings: frame.bindings,
    vars: frame.vars,
    scopedPlayerId: frame.scopedPlayerId,
  });
}

function executeChoosePlayer(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "choosePlayer" }>,
  context: EffectContext,
): void {
  if (frame.answer !== null) {
    const identities = frame.answer
      .map((playerId) => ctx.state.players.find((p) => p.playerId === playerId)?.identity.instanceId)
      .filter((id): id is InstanceId => id !== undefined);
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: identities } });
    return;
  }
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  const players = playerOrder(ctx.state);
  if (!chooser || players.length === 0) {
    setFrame(ctx, { ...frame, cursor: frame.cursor + 1, bindings: { ...frame.bindings, [effect.slot]: [] } });
    return;
  }
  requestChoice(ctx, {
    playerId: chooser,
    prompt: { kind: "choosePlayer", slot: effect.slot },
    options: players.map((p) => ({ optionId: p.playerId, label: p.playerId, ref: { kind: "player", playerId: p.playerId } as const })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
}

/**
 * "Assign X damage among …": one choice per point, tracked in the frame's vars
 * (`_assign.left`, `_assign.to.<id>`); then each chosen character takes its
 * share as a single damage event.
 */
/**
 * "Either spend [E][M][P] resources or …": the player picks a payment from their
 * usual payment options (hand cards, resource abilities). A payment that covers
 * the requirement is spent and `<bind>.made` is 1; selecting nothing or too
 * little spends nothing and `<bind>.made` is 0.
 */
function executeSpendResources(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "spendResources" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const requirement = combineRequirements(effect.resources, 0);
  const finish = (paid: boolean): void =>
    setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1, vars: { ...frame.vars, [`${effect.bind}.made`]: paid ? 1 : 0 } });
  if (frame.answer === null) {
    const options = playerId ? paymentOptions(ctx, playerId, null) : [];
    if (!playerId || options.length === 0) return finish(false);
    requestChoice(ctx, {
      playerId,
      prompt: { kind: "spendResources", requirement },
      options,
      minSelections: 0,
      maxSelections: options.length,
      frameId: frame.frameId,
    });
    return;
  }
  const payment = paymentsFromOptionIds(frame.answer);
  const pool = playerId && payment.length > 0 ? priceOrNull(ctx, playerId, payment, null, null) : null;
  const paid = pool !== null && satisfies(pool, requirement);
  finish(paid);
  if (paid && playerId) payPayment(ctx, playerId, payment);
}

function executeAssignDamage(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "assignDamage" }>,
  context: EffectContext,
): void {
  const vars: Record<string, number> = { ...frame.vars };
  if (vars["_assign.left"] === undefined) vars["_assign.left"] = Math.max(0, resolveValue(ctx.state, effect.amount, context, ctx.deps));
  if (frame.answer !== null) {
    const [picked] = frame.answer;
    if (picked) vars[`_assign.to.${picked}`] = (vars[`_assign.to.${picked}`] ?? 0) + 1;
    vars["_assign.left"] = (vars["_assign.left"] ?? 1) - 1;
  }
  const legal = selectTargets(ctx.state, effect.among, context);
  const [chooser] = resolvePlayers(ctx.state, effect.chooser, context);
  if ((vars["_assign.left"] ?? 0) > 0 && legal.length > 0 && chooser) {
    setFrame(ctx, { ...frame, answer: null, vars });
    requestChoice(ctx, {
      playerId: chooser,
      prompt: { kind: "chooseTarget", slot: "assignDamage", abilityId: null },
      options: cardOptions(ctx, legal),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const shares = Object.entries(vars).filter(([key]) => key.startsWith("_assign.to."));
  const cleaned = Object.fromEntries(Object.entries(vars).filter(([key]) => !key.startsWith("_assign.")));
  setFrame(ctx, { ...frame, answer: null, vars: cleaned, cursor: frame.cursor + 1 });
  pushEvents(
    ctx,
    shares.map(([key, amount]) => ({
      kind: "dealDamage",
      targetInstanceId: asInstanceId(key.slice("_assign.to.".length)),
      amount,
      sourceInstanceId: frame.selfInstanceId,
      fromAttack: false,
    })),
  );
}

/** RRG "Special": each special ability is a step of the sequence; the last step gets `sequence.final`. */
function executeResolveSpecials(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "resolveSpecials" }>,
  context: EffectContext,
): void {
  const steps: TriggerCandidate[] = [];
  for (const id of selectTargets(ctx.state, effect.cards, context)) {
    for (const ref of activeAbilityRefs(ctx.state, id)) {
      if (ctx.deps.abilities[ref.id]?.trigger.kind !== "special") continue;
      steps.push({ instanceId: id, abilityId: ref.id, controllerId: controllerOf(ctx.state, id), forced: true, fromHand: false });
    }
  }
  const key = (c: TriggerCandidate) => `${c.instanceId}:${c.abilityId}`;
  let ordered = steps;
  if (frame.answer !== null) {
    const byKey = new Map(steps.map((c) => [key(c), c]));
    ordered = frame.answer.map((k) => byKey.get(k)).filter((c): c is TriggerCandidate => c !== undefined);
  } else if (steps.length > 1 && frame.controllerId) {
    requestChoice(ctx, {
      playerId: frame.controllerId,
      prompt: { kind: "orderSpecials" },
      options: steps.map(candidateOption(ctx.state)),
      minSelections: steps.length,
      maxSelections: steps.length,
      frameId: frame.frameId,
      ordered: true,
    });
    return;
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  pushFrames(
    ctx,
    ordered.map((step, index) =>
      abilityFrame(ctx, step, frame.event, null, {}, { "sequence.step": index + 1, "sequence.final": index === ordered.length - 1 ? 1 : 0 }),
    ),
  );
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
  const value = (spec: Parameters<typeof resolveValue>[1]): number => resolveValue(ctx.state, spec, context, ctx.deps);
  const reportTo = (bind: string | undefined): ReportTarget | null => (bind ? { frameId: frame.frameId, prefix: bind } : null);

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
        reportTo(effect.bind),
      );
      return;
    }
    case "heal": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({ kind: "healDamage", targetInstanceId: id, amount })),
        reportTo(effect.bind),
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
        reportTo(effect.bind),
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
        reportTo(effect.bind),
      );
      return;
    }
    case "attack": {
      const controller = frame.controllerId;
      const [attacker] = targets(effect.attacker ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !attacker) return;
      let amount = value(effect.amount);
      if (effect.moveDamageFrom) {
        // RRG "Move": moved damage is healed from the source and dealt to the destination; no source, no move.
        const [from] = targets(effect.moveDamageFrom);
        amount = Math.min(amount, from ? mustInstance(ctx.state, from).damage : 0);
        if (!from || amount <= 0) return;
        healDamage(ctx, from, amount);
      }
      // RRG "Attack (Player Ability Type)": attacks can target any enemy unless guard prevents it.
      const attacked = targets(effect.target).filter((id) => canAttack(ctx.state, attacker, id, ctx.deps));
      pushEvents(
        ctx,
        attacked.map((id) => ({
          kind: "attack",
          attackerInstanceId: attacker,
          targetInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          overkill: effect.overkill === true,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "thwart": {
      const controller = frame.controllerId;
      const [thwarter] = targets(effect.thwarter ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !thwarter) return;
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "thwart",
          thwarterInstanceId: thwarter,
          schemeInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "modifyAttack": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const delta: Record<string, number> = {};
      if (effect.overkill) delta.overkill = 1;
      if (effect.atkBonus) delta.atkBonus = value(effect.atkBonus);
      if (effect.threatBonus) delta.threatBonus = value(effect.threatBonus);
      const extra = effect.extraBoostCards ?? 0;
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && f.eventFrameId === activation,
      );
      if (extra > 0 && procedure && procedure.stage !== "giveBoost") {
        // Boost cards are already being flipped: the extra card joins the pile and is flipped too.
        for (let i = 0; i < extra; i++) giveBoostCard(ctx, procedure.enemyInstanceId);
      } else if (extra > 0) {
        delta.extraBoost = extra;
      }
      addFrameVars(ctx, activation, delta);
      return;
    }
    case "atEndOfAttack": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const deferred: DeferredEffects = {
        effects: effect.effects,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        bindings: frame.bindings,
        vars: frame.vars,
      };
      updateFrame(ctx, activation, (f) => (f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f));
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
      const placed: InstanceId[] = [];
      for (const id of targets(effect.card)) {
        const card = cardOf(ctx.state, id);
        // Encounter cards other than minions enter where their type goes (villain area, host, play area).
        if (card && card.type !== "minion" && getInstance(ctx.state, id)?.ownerId === null && !cardsInPlay(ctx.state).includes(id)) {
          updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
          enterPlayOnReveal(ctx, id, controller);
          placed.push(id);
        }
      }
      const entering = targets(effect.card).filter((id) => !placed.includes(id));
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
        vars: frame.vars,
        scopedPlayerId: frame.scopedPlayerId,
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
    case "preventDamage":
    case "preventThreat": {
      const kind = effect.kind === "preventDamage" ? "dealDamage" : "placeThreat";
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== kind || target.cancelled) return;
      const pending = target.event.amount;
      const prevented = effect.amount === undefined ? pending : Math.min(pending, Math.max(0, value(effect.amount)));
      if (prevented <= 0) return;
      setFrame(ctx, { ...target, event: { ...target.event, amount: pending - prevented } });
      if (target.event.kind === "dealDamage") {
        emit(ctx, { type: "damagePrevented", targetInstanceId: target.event.targetInstanceId, amount: prevented, reason: "effect" });
      } else if (target.event.kind === "placeThreat") {
        emit(ctx, { type: "threatPrevented", schemeInstanceId: target.event.schemeInstanceId, amount: prevented });
      }
      return;
    }
    case "replaceTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) => (target.kind === "event" ? { ...target, cancelled: true } : target));
      pushEffects(ctx, {
        effects: effect.with,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: null,
        bindings: frame.bindings,
        vars: frame.vars,
      });
      return;
    }
    case "cancelWhenRevealed":
    case "cancelRevealedCard": {
      const revealing = frame.event?.kind === "encounterCardRevealing" ? frame.event.instanceId : null;
      const reveal = ctx.state.stack.find((f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === revealing);
      if (!reveal) return;
      const all = effect.kind === "cancelRevealedCard";
      setFrame(ctx, all ? { ...reveal, effectsCancelled: true } : { ...reveal, whenRevealedCancelled: true });
      emit(ctx, { type: "revealCancelled", instanceId: reveal.instanceId, scope: all ? "allEffects" : "whenRevealed" });
      return;
    }
    case "placeDamage": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const id of targets(effect.target)) {
        updateInstance(ctx, id, (i) => ({ ...i, damage: i.damage + amount }));
        emit(ctx, { type: "damagePlaced", targetInstanceId: id, amount, sourceInstanceId: frame.selfInstanceId });
      }
      checkDefeats(ctx);
      return;
    }
    case "bindTargets": {
      const ids = targets(effect.target);
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [effect.slot]: ids } } : f));
      return;
    }
    case "modifyStatUntil":
    case "grantTraitUntil": {
      let duration: LastingDuration;
      if (effect.until === "endOfAttack") {
        const activation = currentActivationFrameId(ctx.state.stack);
        if (!activation) return;
        duration = { kind: "endOfEvent", frameId: activation };
      } else {
        duration = { kind: effect.until };
      }
      const reach = {
        targets: effect.target ? targets(effect.target) : null,
        affects: effect.affects ?? null,
      };
      const scope: LastingScope = {
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        vars: frame.vars,
        bindings: frame.bindings,
      };
      addLastingEffect(
        ctx,
        effect.kind === "modifyStatUntil"
          ? { kind: "statModifier", stat: effect.stat, amount: effect.amount, scope, ...reach }
          : { kind: "traitGrant", trait: effect.trait, scope, ...reach },
        duration,
      );
      return;
    }
    case "atEndOfRound":
      addLastingEffect(
        ctx,
        {
          kind: "delayedEffects",
          effects: effect.effects,
          scope: { selfInstanceId: frame.selfInstanceId, controllerId: frame.controllerId, vars: frame.vars, bindings: frame.bindings },
        },
        { kind: "endOfRound" },
      );
      return;
    case "moveCards": {
      const ids = selectCards(ctx, effect.cards, context);
      if (effect.bind) {
        // Record what moved (and its printed resources) before it moves.
        const pool = ids.reduce((sum, id) => {
          const card = cardOf(ctx.state, id);
          return card ? addPools(sum, printedResources(card)) : sum;
        }, EMPTY_POOL);
        const bind = effect.bind;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [bind]: ids },
                vars: {
                  ...f.vars,
                  [`${bind}.count`]: ids.length,
                  [`${bind}.physical`]: pool.physical,
                  [`${bind}.mental`]: pool.mental,
                  [`${bind}.energy`]: pool.energy,
                  [`${bind}.wild`]: pool.wild,
                },
              }
            : f,
        );
      }
      moveCardsTo(ctx, ids, effect.to);
      return;
    }
    case "shuffleDeck":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const order = shuffleZone(ctx, { kind: "deck", playerId }, mustPlayer(ctx.state, playerId).deck);
        updatePlayer(ctx, playerId, (p) => ({ ...p, deck: order }));
      }
      return;
    case "changeForm": {
      const changed: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const current = mustPlayer(ctx.state, playerId).identity.form;
        const to = effect.to ?? (current === "hero" ? "alterEgo" : "hero");
        if (to === current) continue;
        setForm(ctx, playerId, to, false);
        changed.push({ kind: "formChanged", playerId, to });
      }
      pushEvents(ctx, changed);
      return;
    }
    case "drawUpTo":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const missing = value(effect.amount) - mustPlayer(ctx.state, playerId).hand.length;
        if (missing > 0) drawCards(ctx, playerId, missing);
      }
      return;
    case "forEachPlayer": {
      const players = resolvePlayers(ctx.state, effect.players, context);
      // Pushed in reverse so the first player's pass resolves first.
      for (const playerId of [...players].reverse()) {
        pushEffects(ctx, {
          effects: effect.effects,
          selfInstanceId: frame.selfInstanceId,
          controllerId: frame.controllerId,
          event: frame.event,
          eventFrameId: frame.eventFrameId,
          bindings: frame.bindings,
          vars: frame.vars,
          scopedPlayerId: playerId,
        });
      }
      return;
    }
    case "enemyAttack":
    case "enemyScheme": {
      const attacking = effect.kind === "enemyAttack";
      const against = effect.against ? resolvePlayers(ctx.state, effect.against, context) : null;
      const events: TriggerEvent[] = [];
      for (const enemy of targets(effect.enemies)) {
        const categories = categoriesOf(ctx.state, enemy);
        if (!categories.includes("enemy") || !cardsInPlay(ctx.state).includes(enemy)) continue;
        if (enemy === ctx.state.villain.instanceId && ctx.state.villain.defeated) continue;
        const players = against ?? [getInstance(ctx.state, enemy)?.engagedWith ?? frame.controllerId].filter((p): p is PlayerId => p !== null);
        for (const playerId of players) {
          const player = getPlayer(ctx.state, playerId);
          if (!player || player.eliminated) continue;
          if (characterProfile(ctx.state, enemy, ctx.deps)?.missing.includes(attacking ? "atk" : "sch")) continue;
          const status = attacking ? "stunned" : "confused";
          if (statusActive(ctx.state, enemy, status, ctx.deps)) {
            // RRG "Stun"/"Confuse": the status is discarded instead; the enemy did not attack/scheme.
            updateInstance(ctx, enemy, (i) => ({ ...i, statuses: { ...i.statuses, [status]: 0 } }));
            emit(ctx, { type: "statusRemoved", instanceId: enemy, status, reason: attacking ? "cancelledAttack" : "cancelledSchemeOrThwart" });
            continue;
          }
          events.push(
            attacking
              ? {
                  kind: "enemyAttack",
                  enemyInstanceId: enemy,
                  attackedPlayerId: playerId,
                  targetPlayerId: playerId,
                  targetInstanceId: player.identity.instanceId,
                  ...(effect.kind === "enemyAttack" && effect.additionalResolution ? { additionalResolution: true } : {}),
                }
              : { kind: "enemyScheme", enemyInstanceId: enemy, playerId },
          );
        }
      }
      pushEvents(ctx, events, reportTo(effect.bind));
      return;
    }
    case "selectCards": {
      const ids = selectCards(ctx, effect.cards, context);
      const slot = effect.slot;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [slot]: ids }, vars: { ...f.vars, [`${slot}.count`]: ids.length } } : f,
      );
      return;
    }
    case "revealCard": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      const frames: StackFrame[] = [];
      for (const id of targets(effect.cards)) {
        // Park it with the revealing player's dealt cards while it resolves (out of the deck/discard it came from).
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        frames.push(revealFrame(ctx, playerId, id));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "shuffleEncounterDeck":
      shuffleEncounterDeck(ctx);
      return;
    case "discardEncounterUntil": {
      // Bounded by the number of encounter cards, so a deck with no match can't loop forever.
      const limit = ctx.state.encounterDeck.length + ctx.state.encounterDiscard.length;
      let found: InstanceId | null = null;
      for (let i = 0; i < limit && found === null; i++) {
        const id = drawEncounterCard(ctx);
        if (!id) break;
        updateInstance(ctx, id, (inst) => ({ ...inst, faceup: true }));
        moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
        if (matchesQuery(ctx.state, id, effect.filter, context)) found = id;
      }
      const bind = effect.bind;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [bind]: found ? [found] : [] }, vars: { ...f.vars, [`${bind}.count`]: found ? 1 : 0 } } : f,
      );
      return;
    }
    case "tuckCards": {
      const [host] = targets(effect.under);
      if (!host) return;
      for (const id of selectCards(ctx, effect.cards, context)) {
        moveCard(ctx, id, { kind: "tucked", hostInstanceId: host });
        updateInstance(ctx, id, (i) => ({ ...i, faceup: effect.facedown !== true }));
      }
      return;
    }
    case "putIntoPlayFacedown": {
      const count = effect.count ? value(effect.count) : 1;
      const entered: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        for (let i = 0; i < count; i++) {
          const id = takeTopOfDeck(ctx, playerId);
          if (!id) break;
          moveCard(ctx, id, { kind: "playArea", playerId });
          // Engaged with that player like any minion; it belongs to the encounter side while facedown.
          updateInstance(ctx, id, (inst) => ({ ...inst, faceup: false, controllerId: null, engagedWith: playerId, facedownAs: effect.as }));
          emit(ctx, { type: "cardPutIntoPlayFacedown", instanceId: id, playerId, as: effect.as.kind });
          entered.push({ kind: "cardEntersPlay", instanceId: id, playerId });
        }
      }
      pushEvents(ctx, entered);
      checkDefeats(ctx);
      return;
    }
    case "gainSurge": {
      const reveal = ctx.state.stack.find((f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === frame.selfInstanceId);
      if (reveal) setFrame(ctx, { ...reveal, surgeGained: true });
      return;
    }
    case "chooseCards":
    case "chooseOne":
    case "choosePlayer":
    case "resolveSpecials":
    case "assignDamage":
      throw new EngineInvariantError(`${effect.kind} is handled before applyEffect`);
    case "reduceNextCardCost": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        addLastingEffect(
          ctx,
          { kind: "costReduction", playerId, amount },
          { kind: effect.duration === "phase" ? "endOfPhase" : "endOfRound" },
        );
      }
      return;
    }
    case "chooseTarget":
      throw new EngineInvariantError("chooseTarget is handled before applyEffect");
    case "spendResources":
      throw new EngineInvariantError("spendResources is handled before applyEffect");
  }
}

// ---------------------------------------------------------------------------
// Event application
// ---------------------------------------------------------------------------

/** Applies an event's state change; returns false if the event turned out not to happen. */
function applyEvent(ctx: Ctx, frame: Frame<"event">): boolean | void {
  const event = frame.event;
  switch (event.kind) {
    case "dealDamage":
      return applyDamage(ctx, event, frame.frameId);
    case "healDamage": {
      const before = getInstance(ctx.state, event.targetInstanceId)?.damage ?? 0;
      healDamage(ctx, event.targetInstanceId, event.amount);
      const after = getInstance(ctx.state, event.targetInstanceId)?.damage ?? 0;
      addFrameVars(ctx, frame.frameId, { amount: before - after });
      return;
    }
    case "placeThreat":
      return applyPlaceThreat(ctx, event, frame.frameId);
    case "removeThreat":
      return applyRemoveThreat(ctx, event, frame.frameId);
    case "attack":
      return applyPlayerAttack(ctx, event, frame.frameId);
    case "thwart":
      return applyPlayerThwart(ctx, event, frame.frameId);
    case "enemyAttack":
      return pushEnemyAttackFrame(ctx, event, frame.frameId);
    case "enemyScheme":
      return pushEnemySchemeFrame(ctx, event, frame.frameId);
    case "characterAttacked":
      return applyRetaliate(ctx, event);
    case "characterDefeated":
      return applyDefeat(ctx, event);
    default:
      return;
  }
}

/**
 * RRG "Defeat": an ally or minion with damage equal to its hit points is
 * defeated and discarded (attachments with it). Runs after the defeat's
 * interrupt window, so a "would be defeated … instead" effect that healed it
 * means nothing happens. Overkill excess is dealt only if the defeat happens.
 */
function applyDefeat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterDefeated" }>): boolean {
  const id = event.instanceId;
  const instance = getInstance(ctx.state, id);
  if (!instance || !cardsInPlay(ctx.state).includes(id)) return false;
  const profile = characterProfile(ctx.state, id, ctx.deps);
  if (!profile || instance.damage < profile.maxHp) return false;
  if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) return false;
  emit(ctx, { type: "characterDefeated", instanceId: id, cardId: instance.cardId });
  const whenDefeated = gameAbilityFrames(ctx, id, ["whenDefeated"], event, undefined, instance.engagedWith ?? ctx.state.firstPlayerId);
  discardFromPlay(ctx, id);
  addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
  const frames: StackFrame[] = [...whenDefeated];
  if (event.overkill && !ctx.state.outcome && getInstance(ctx.state, event.overkill.toInstanceId)) {
    emit(ctx, { type: "overkillSpilled", fromInstanceId: id, toInstanceId: event.overkill.toInstanceId, amount: event.overkill.amount });
    // RRG "Overkill": spilled damage is attack damage but not an attack against that character.
    frames.push(
      eventFrame(ctx, {
        kind: "dealDamage",
        targetInstanceId: event.overkill.toInstanceId,
        amount: event.overkill.amount,
        sourceInstanceId: event.overkill.sourceInstanceId,
        fromAttack: true,
      }),
    );
  }
  pushFrames(ctx, frames);
  return true;
}

/**
 * RRG "Overkill": excess damage spills to the villain when the attack defeats a
 * minion, and to the controlling player's hero when an *ally used to defend*
 * is defeated — an ally hit by anything other than a defense does not spill.
 */
function overkillRecipient(state: GameState, targetId: InstanceId): InstanceId | null {
  const card = cardOf(state, targetId);
  if (isMinion(state, targetId)) return state.villain.instanceId;
  if (card?.type !== "ally") return null;
  const defended = state.stack.some(
    (frame) => frame.kind === "enemyAttack" && frame.defenderInstanceId === targetId,
  );
  if (!defended) return null;
  const controller = controllerOf(state, targetId);
  return controller ? (getPlayer(state, controller)?.identity.instanceId ?? null) : null;
}

/** RRG "Tough": a tough status prevents all damage and is discarded instead. */
function applyDamage(ctx: Ctx, event: Extract<TriggerEvent, { kind: "dealDamage" }>, frameId: FrameId): void {
  if (event.amount <= 0) return;
  const source = event.sourceInstanceId;
  const attackKeyword = (name: "piercing" | "overkill"): boolean =>
    event.fromAttack && source !== null && hasKeyword(ctx.state, source, name, ctx.deps);

  // RRG "Cannot": "cannot take damage" beats everything, including tough (which then isn't used).
  if (cannotTakeDamage(ctx.state, ctx.deps, event.targetInstanceId, [source, event.viaInstanceId])) {
    emit(ctx, { type: "damagePrevented", targetInstanceId: event.targetInstanceId, amount: event.amount, reason: "cannotTakeDamage" });
    return;
  }
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
  addFrameVars(ctx, frameId, { amount: event.amount });
  addFrameVars(ctx, event.parentFrameId, { damage: event.amount, damaged: 1 });
  addFrameSlots(ctx, event.parentFrameId, { damaged: [event.targetInstanceId] });

  const profile = characterProfile(ctx.state, event.targetInstanceId, ctx.deps);
  const damage = mustInstance(ctx.state, event.targetInstanceId).damage;
  const overkill = event.fromAttack && (event.overkill === true || attackKeyword("overkill"));
  const excess = overkill && profile ? damage - profile.maxHp : 0;
  const recipient = excess > 0 ? overkillRecipient(ctx.state, event.targetInstanceId) : null;
  const villainStage = ctx.state.villain.stageIndex;

  checkDefeats(ctx, {
    targetId: event.targetInstanceId,
    parentFrameId: event.parentFrameId ?? null,
    overkill: recipient ? { amount: excess, toInstanceId: recipient, sourceInstanceId: source } : undefined,
    defeatedByPlayerId: source !== null ? controllerOf(ctx.state, source) : null,
  });

  // Allies and minions report their defeat when the defeat event applies; a villain stage falls now.
  if (event.targetInstanceId === ctx.state.villain.instanceId && (ctx.state.villain.stageIndex !== villainStage || ctx.state.villain.defeated)) {
    addFrameVars(ctx, event.parentFrameId, { defeated: 1 });
  }
}

/**
 * RRG "Retaliate X": a forced response after the character is attacked; it must
 * still be in play once the attack resolves. RRG "Ranged": an attack with ranged
 * ignores retaliate entirely.
 */
function applyRetaliate(ctx: Ctx, event: Extract<TriggerEvent, { kind: "characterAttacked" }>): void {
  if (hasKeyword(ctx.state, event.attackerInstanceId, "ranged", ctx.deps)) return;
  const inPlay = cardsInPlay(ctx.state);
  if (!inPlay.includes(event.targetInstanceId) || !inPlay.includes(event.attackerInstanceId)) return;
  const amount = keywordTotal(ctx.state, event.targetInstanceId, "retaliate", ctx.deps);
  if (amount <= 0) return;
  pushEvent(ctx, {
    kind: "dealDamage",
    targetInstanceId: event.attackerInstanceId,
    amount,
    sourceInstanceId: event.targetInstanceId,
    fromAttack: false,
  });
}

function applyPlaceThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "placeThreat" }>, frameId: FrameId): void {
  if (event.amount <= 0) return;
  if (!getInstance(ctx.state, event.schemeInstanceId)) return;
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat + event.amount }));
  emit(ctx, {
    type: "threatPlaced",
    schemeInstanceId: event.schemeInstanceId,
    amount: event.amount,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: event.amount });
  addFrameVars(ctx, event.parentFrameId, { threatPlaced: event.amount });
  if (event.schemeInstanceId === ctx.state.mainScheme.instanceId) checkMainSchemeCompletion(ctx);
}

function applyRemoveThreat(ctx: Ctx, event: Extract<TriggerEvent, { kind: "removeThreat" }>, frameId: FrameId): void {
  const scheme = getInstance(ctx.state, event.schemeInstanceId);
  if (!scheme) return;
  // RRG "Crisis Icon": while a crisis icon is in play, players cannot remove threat from the main scheme.
  const byPlayer = event.sourceInstanceId === null || controllerOf(ctx.state, event.sourceInstanceId) !== null;
  if (event.schemeInstanceId === ctx.state.mainScheme.instanceId && byPlayer && countSchemeIcons(ctx.state, "crisis") > 0) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: "crisis" });
    return;
  }
  if (threatCannotBeRemoved(ctx.state, ctx.deps, event.schemeInstanceId)) {
    emit(ctx, { type: "threatRemovalBlocked", schemeInstanceId: event.schemeInstanceId, reason: "rule" });
    return;
  }
  const removed = Math.min(event.amount, scheme.threat);
  if (removed <= 0) return;
  updateInstance(ctx, event.schemeInstanceId, (i) => ({ ...i, threat: i.threat - removed }));
  emit(ctx, {
    type: "threatRemoved",
    schemeInstanceId: event.schemeInstanceId,
    amount: removed,
    sourceInstanceId: event.sourceInstanceId,
  });
  addFrameVars(ctx, frameId, { amount: removed });
  addFrameVars(ctx, event.parentFrameId, { threatRemoved: removed });
  const after = mustInstance(ctx.state, event.schemeInstanceId);
  const card = cardOf(ctx.state, event.schemeInstanceId);
  const isSideScheme = card?.type === "side_scheme" || card?.type === "player_side_scheme";
  if (isSideScheme && after.threat === 0) {
    emit(ctx, { type: "schemeDefeated", instanceId: event.schemeInstanceId, cardId: after.cardId });
    // Its "When Defeated" resolves first, then it leaves play (so tucked cards it returns aren't discarded first).
    const effectsFrame: StackFrame = {
      ...base(ctx),
      kind: "effects",
      effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: event.schemeInstanceId,
      controllerId: null,
      event: null,
      eventFrameId: null,
    };
    pushFrames(ctx, [
      ...gameAbilityFrames(ctx, event.schemeInstanceId, ["whenDefeated"], null, undefined, ctx.state.firstPlayerId),
      effectsFrame,
      eventFrame(ctx, { kind: "schemeDefeated", instanceId: event.schemeInstanceId }),
    ]);
  }
}

function applyPlayerAttack(ctx: Ctx, event: Extract<TriggerEvent, { kind: "attack" }>, frameId: FrameId): void {
  const profile = characterProfile(ctx.state, event.attackerInstanceId, ctx.deps);
  if (!getInstance(ctx.state, event.targetInstanceId)) return;
  if (profile?.missing.includes("atk")) return;
  const amount = event.amount ?? profile?.atk;
  if (amount === undefined) return;
  pushEvents(ctx, [
    {
      kind: "dealDamage",
      targetInstanceId: event.targetInstanceId,
      amount,
      sourceInstanceId: event.attackerInstanceId,
      fromAttack: true,
      parentFrameId: frameId,
      overkill: event.overkill === true,
      viaInstanceId: event.sourceInstanceId ?? null,
    },
    {
      kind: "characterAttacked",
      attackerInstanceId: event.attackerInstanceId,
      targetInstanceId: event.targetInstanceId,
      playerId: event.playerId,
    },
  ]);
}

function applyPlayerThwart(ctx: Ctx, event: Extract<TriggerEvent, { kind: "thwart" }>, frameId: FrameId): void {
  const thwarter = characterProfile(ctx.state, event.thwarterInstanceId, ctx.deps);
  if (thwarter?.missing.includes("thw")) return;
  const amount = event.amount ?? thwarter?.thw;
  if (amount === undefined) return;
  pushEvent(ctx, {
    kind: "removeThreat",
    schemeInstanceId: event.schemeInstanceId,
    amount,
    sourceInstanceId: event.thwarterInstanceId,
    parentFrameId: frameId,
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
function flipNextBoostCard(ctx: Ctx, enemyId: InstanceId, playerId: PlayerId): number | null {
  const [boostId] = mustInstance(ctx.state, enemyId).boostCards;
  if (!boostId) return null;
  updateInstance(ctx, boostId, (i) => ({ ...i, faceup: true }));
  const card = mustCardOf(ctx.state, boostId);
  const value = boostIconsOf(card);
  emit(ctx, { type: "boostCardFlipped", enemyInstanceId: enemyId, instanceId: boostId, boostIcons: value });
  const frames = gameAbilityFrames(ctx, boostId, ["boost"], null, undefined, playerId);
  moveCard(ctx, boostId, { kind: "encounterDiscard" }, "top");
  pushFrames(ctx, frames);
  return value;
}

/** An activation's recorded modifications ("gains overkill", "+N ATK", extra boost cards). */
const activationVars = (ctx: Ctx, eventFrameId: FrameId | null): Vars => {
  const frame = eventFrameId ? ctx.state.stack.find((f) => f.frameId === eventFrameId) : undefined;
  return frame?.kind === "event" ? frame.vars : {};
};

/** Records a defender on the attack procedure and its event, and announces the defense. */
function setDefender(ctx: Ctx, frame: Frame<"enemyAttack">, defenderId: InstanceId, defenderPlayer: PlayerId, basic: boolean): void {
  setFrame(ctx, {
    ...frame,
    defenderInstanceId: defenderId,
    targetInstanceId: defenderId,
    targetPlayerId: defenderPlayer,
    basicDefense: basic,
  });
  if (frame.eventFrameId) {
    updateFrame(ctx, frame.eventFrameId, (f) =>
      f.kind === "event" && f.event.kind === "enemyAttack"
        ? { ...f, event: { ...f.event, targetInstanceId: defenderId, targetPlayerId: defenderPlayer } }
        : f,
    );
  }
  announce(ctx, { kind: "defended", defenderInstanceId: defenderId, enemyInstanceId: frame.enemyInstanceId, playerId: defenderPlayer, basic });
}

function pushEnemyAttackFrame(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyAttack" }>, eventFrameId: FrameId): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyAttack",
      enemyInstanceId: event.enemyInstanceId,
      attackedPlayerId: event.attackedPlayerId,
      targetPlayerId: event.targetPlayerId,
      targetInstanceId: event.targetInstanceId,
      // A "(defense)" ability used while the attack was initiated already made the identity the defender.
      defenderInstanceId: (activationVars(ctx, eventFrameId).labeledDefense ?? 0) > 0 ? event.targetInstanceId : null,
      basicDefense: false,
      boostIcons: 0,
      stage: "giveBoost",
      eventFrameId,
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
      const extra = activationVars(ctx, frame.eventFrameId).extraBoost ?? 0;
      for (let i = 0; i < 1 + extra; i++) giveBoostCard(ctx, frame.enemyInstanceId);
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
          if (frame.defenderInstanceId === null) addFrameVars(ctx, frame.eventFrameId, { undefended: 1 });
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
        exhaustCard(ctx, defenderId);
        setDefender(ctx, { ...frame, answer: null, stage: "flipBoosts" }, defenderId, defenderPlayer, true);
        return;
      }
      // RRG "Defend, Defense": with a "(defense)" defender already set, only that
      // hero may still make a basic defense; nobody else can defend this attack.
      const existing = frame.defenderInstanceId;
      const all = legalDefenders(ctx.state, frame.attackedPlayerId);
      // "Must defend with an ally they control, if able" (Melter): only the engaged player's ready allies, no declining.
      const forcedAllies = mustDefendWithAlly(ctx.state, ctx.deps, frame.enemyInstanceId)
        ? all.filter((id) => cardOf(ctx.state, id)?.type === "ally" && controllerOf(ctx.state, id) === frame.attackedPlayerId)
        : [];
      const defenders = existing ? all.filter((id) => id === existing) : forcedAllies.length > 0 ? forcedAllies : all;
      if (defenders.length === 0) {
        setFrame(ctx, { ...frame, stage: "flipBoosts" });
        if (existing === null) addFrameVars(ctx, frame.eventFrameId, { undefended: 1 });
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
          ...(forcedAllies.length > 0 && !existing ? [] : [{ optionId: "decline", label: "No defense", ref: { kind: "none" } } as const]),
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
      // RRG "Attack (Enemy Activation)" step 3: one boost card at a time, in the order dealt.
      const icons = flipNextBoostCard(ctx, frame.enemyInstanceId, frame.attackedPlayerId);
      if (icons === null) {
        setFrame(ctx, { ...frame, stage: "dealDamage" });
        return;
      }
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "enemyAttack" ? { ...f, boostIcons: f.boostIcons + icons } : f));
      return;
    }
    case "dealDamage": {
      setFrame(ctx, { ...frame, stage: "done" });
      const enemyProfile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!enemyProfile) return;
      const vars = activationVars(ctx, frame.eventFrameId);
      const defenderProfile = frame.defenderInstanceId
        ? characterProfile(ctx.state, frame.defenderInstanceId, ctx.deps)
        : undefined;
      // Only a basic defense by a hero reduces damage by DEF (RRG "Defend, Defense").
      const reduction = frame.basicDefense && defenderProfile?.kind === "identity" ? defenderProfile.def : 0;
      const atk = enemyProfile.atk + (vars.atkBonus ?? 0);
      addFrameSlots(ctx, frame.eventFrameId, { target: [frame.targetInstanceId] });
      const damage = Math.max(0, atk + frame.boostIcons - reduction);
      emit(ctx, {
        type: "attackResolved",
        enemyInstanceId: frame.enemyInstanceId,
        targetInstanceId: frame.targetInstanceId,
        baseAtk: atk,
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
          parentFrameId: frame.eventFrameId,
          overkill: (vars.overkill ?? 0) > 0,
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

function pushEnemySchemeFrame(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyScheme" }>, eventFrameId: FrameId): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyScheme",
      enemyInstanceId: event.enemyInstanceId,
      playerId: event.playerId,
      boostIcons: 0,
      stage: "giveBoost",
      eventFrameId,
    },
  ]);
}

function executeEnemySchemeFrame(ctx: Ctx, frame: Frame<"enemyScheme">): void {
  switch (frame.stage) {
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "flipBoosts" });
      const extra = activationVars(ctx, frame.eventFrameId).extraBoost ?? 0;
      for (let i = 0; i < 1 + extra; i++) giveBoostCard(ctx, frame.enemyInstanceId);
      return;
    }
    case "flipBoosts": {
      const icons = flipNextBoostCard(ctx, frame.enemyInstanceId, frame.playerId);
      if (icons === null) {
        setFrame(ctx, { ...frame, stage: "placeThreat" });
        return;
      }
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "enemyScheme" ? { ...f, boostIcons: f.boostIcons + icons } : f));
      return;
    }
    case "placeThreat": {
      setFrame(ctx, { ...frame, stage: "done" });
      const profile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!profile) return;
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId: ctx.state.mainScheme.instanceId,
        amount: Math.max(0, profile.sch + frame.boostIcons + (activationVars(ctx, frame.eventFrameId).threatBonus ?? 0)),
        sourceInstanceId: frame.enemyInstanceId,
        parentFrameId: frame.eventFrameId,
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
  whenRevealedCancelled: false,
  effectsCancelled: false,
  surgeGained: false,
  stage: "faceup",
});

export function pushRevealFrame(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  pushFrames(ctx, [revealFrame(ctx, playerId, id)]);
}

const HOST_QUERIES: Partial<Record<AttachmentHost["kind"], TargetQuery>> = {
  sideScheme: { categories: ["sideScheme"] },
  hero: { categories: ["hero"] },
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  anyCharacter: { categories: ["character"] },
};

const printedHpOf = (state: GameState, id: InstanceId): number => {
  const card = cardOf(state, id);
  return card && "hp" in card && typeof card.hp === "number" ? card.hp : 0;
};

/**
 * Every legal host for an attachment right now, in stable order. For
 * `minionWithHighestPrintedHp` this is the set of minions tied for highest
 * printed HP (the revealing player breaks ties).
 */
export function attachmentHostCandidates(
  state: GameState,
  host: AttachmentHost,
  context: EffectContext,
): readonly InstanceId[] {
  switch (host.kind) {
    case "villain":
      return [state.villain.instanceId];
    case "mainScheme":
      return [state.mainScheme.instanceId];
    case "namedCard":
      return selectTargets(state, { name: host.name }, context);
    case "minionWithHighestPrintedHp": {
      const minions = selectTargets(state, { categories: ["minion"] }, context).filter(
        (id) =>
          host.withoutAttachmentNamed === undefined ||
          !mustInstance(state, id).attachments.some((a) => cardOf(state, a)?.name === host.withoutAttachmentNamed),
      );
      const highest = Math.max(...minions.map((id) => printedHpOf(state, id)));
      return minions.filter((id) => printedHpOf(state, id) === highest);
    }
    default: {
      const query = HOST_QUERIES[host.kind];
      return query ? selectTargets(state, query, context) : [];
    }
  }
}

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
      // The card is faceup and about to resolve: cancel effects interrupt here
      // (FFG ruling: Black Widow triggers after the flip, before its effects).
      pushEvent(ctx, { kind: "encounterCardRevealing", instanceId: frame.instanceId, playerId: frame.playerId });
      return;
    }
    case "enterPlay": {
      if (card.type === "obligation" && !frame.effectsCancelled) {
        // RRG "Obligation": give it to the player whose identity it belongs to; that player reveals it.
        const linked = Object.values(ctx.state.cardPool).some((c) => c.type === "hero_identity" && c.obligationCardId === card.id);
        const owner = ctx.state.players.find((p) => {
          const identity = cardOf(ctx.state, p.identity.instanceId);
          return identity?.type === "hero_identity" && identity.obligationCardId === card.id;
        });
        if (linked && (!owner || owner.eliminated)) {
          // Can't be given: ignore its ability, remove it from the game, reveal another card.
          moveCard(ctx, frame.instanceId, { kind: "removedFromGame" });
          setFrame(ctx, { ...frame, stage: "done" });
          const next = dealEncounterCardTo(ctx, frame.playerId);
          if (next) pushFrames(ctx, [revealFrame(ctx, frame.playerId, next)]);
          return;
        }
        const revealer = owner && linked ? owner.playerId : frame.playerId;
        setFrame(ctx, { ...frame, playerId: revealer, answer: null, stage: "whenRevealed" });
        enterPlayOnReveal(ctx, frame.instanceId, revealer);
        return;
      }
      if (frame.effectsCancelled) {
        // RRG "Cancel": a canceled card is still revealed; it is discarded and nothing else happens.
        if (getInstance(ctx.state, frame.instanceId)) moveCard(ctx, frame.instanceId, { kind: "encounterDiscard" }, "top");
        setFrame(ctx, { ...frame, stage: "finish" });
        return;
      }
      if (card.type === "attachment" && card.attachesTo.kind !== "villain") {
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
      // Incite and surge are "When Revealed" effects too (RRG "Incite X", "Surge").
      if (frame.whenRevealedCancelled) return;
      const revealed: TriggerEvent = {
        kind: "cardRevealed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
      };
      const frames: StackFrame[] = [];
      // RRG "Incite X" is itself a "When Revealed: place X threat on the main scheme".
      const incite = keywordTotal(ctx.state, frame.instanceId, "incite", ctx.deps);
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
      frames.push(...gameAbilityFrames(ctx, frame.instanceId, ["whenRevealed"], revealed, undefined, frame.playerId));
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
      const quickstrike = frame.effectsCancelled ? null : quickstrikeAttack(ctx.state, frame.instanceId);
      if (quickstrike) events.push(quickstrike);
      const frames: StackFrame[] = events.map((event) => eventFrame(ctx, event));
      // RRG "Surge": the original card is fully resolved first, then the same
      // player reveals one more — so the extra reveal is queued last.
      const surgeLive = !frame.effectsCancelled && !frame.whenRevealedCancelled;
      if (surgeLive && (frame.surgeGained || hasKeyword(ctx.state, frame.instanceId, "surge", ctx.deps))) {
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
  for (const keyword of keywordsOf(ctx.state, id, ctx.deps)) {
    if (keyword.name === "toughness") giveStatus(ctx, id, "tough");
    if (keyword.name === "uses") addCounters(ctx, id, keyword.counterType, keyword.count);
  }
  if (hasKeyword(ctx.state, id, "restricted", ctx.deps)) checkRestricted(ctx, controllerOf(ctx.state, id));
  if (cardOf(ctx.state, id)?.type === "ally") checkAllyLimit(ctx, controllerOf(ctx.state, id));
}

/**
 * RRG "Ally Limit": allies may be played past the limit, but the controller then
 * immediately discards down to it — before abilities that resolve on entering play.
 */
function checkAllyLimit(ctx: Ctx, playerId: PlayerId | null): void {
  if (!playerId || ctx.state.pendingChoice) return;
  const allies = mustPlayer(ctx.state, playerId).playArea.filter(
    (id) => cardOf(ctx.state, id)?.type === "ally" && controllerOf(ctx.state, id) === playerId,
  );
  const limit = allyLimitFor(ctx.state, ctx.deps, playerId);
  if (allies.length <= limit) return;
  requestChoice(ctx, {
    playerId,
    prompt: { kind: "discardOverAllyLimit", limit },
    options: allies.map((id) => ({ optionId: id, label: mustCardOf(ctx.state, id).name, ref: { kind: "card", instanceId: id } as const })),
    minSelections: allies.length - limit,
    maxSelections: allies.length - limit,
  });
}

/**
 * RRG "Restricted": playing a third is illegal (see `playCard`), but an effect
 * can still put one into play — then the controller discards down to two.
 */
function checkRestricted(ctx: Ctx, playerId: PlayerId | null): void {
  if (!playerId) return;
  const held = restrictedCardsOf(ctx.state, playerId, ctx.deps);
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
    case "attachment": {
      // Setup-keyword attachments enter play without a reveal frame, so there is
      // no choice point: the first legal host in stable order is used.
      const context: EffectContext = { selfInstanceId: id, controllerId: playerId, event: null, bindings: {}, deps: ctx.deps };
      const [host] = attachmentHostCandidates(ctx.state, card.attachesTo, context);
      if (!host) {
        moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
        break;
      }
      moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
      entered = true;
      break;
    }
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
function resolveAttachmentTarget(ctx: Ctx, frame: Frame<"reveal">, attachesTo: AttachmentHost): boolean {
  const context: EffectContext = {
    selfInstanceId: frame.instanceId,
    controllerId: frame.playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  const legal = attachmentHostCandidates(ctx.state, attachesTo, context);
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
  cost?: { readonly bindings: Bindings; readonly vars: Vars },
  controllerId: PlayerId = playerId,
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "playCard",
      instanceId: id,
      playerId,
      controllerId,
      attachToInstanceId,
      stage: "enterPlay",
      triggeredAbilityId: triggered?.triggeredAbilityId ?? null,
      event: triggered?.event ?? null,
      eventFrameId: triggered?.eventFrameId ?? null,
      bindings: cost?.bindings ?? {},
      vars: cost?.vars ?? {},
    },
  ]);
}

function executePlayCardFrame(ctx: Ctx, frame: Frame<"playCard">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  switch (frame.stage) {
    case "enterPlay": {
      setFrame(ctx, { ...frame, stage: "effects" });
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, controllerId: frame.controllerId, faceup: true }));
      switch (card.type) {
        case "ally":
        case "support":
          moveCard(ctx, frame.instanceId, { kind: "playArea", playerId: frame.controllerId });
          enterPlay(ctx, frame.instanceId, frame.controllerId);
          break;
        case "upgrade": {
          const host = frame.attachToInstanceId ?? mustPlayer(ctx.state, frame.controllerId).identity.instanceId;
          moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
          enterPlay(ctx, frame.instanceId, frame.controllerId);
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
            frame.bindings,
            frame.vars,
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

/**
 * RRG "Main Scheme": excess threat does not carry over; acceleration tokens do.
 * The new stage's A side is revealed first (its "When Revealed" resolves), then
 * the B side (its own "When Revealed", if any), then the B side's starting
 * threat is placed.
 */
function advanceMainScheme(ctx: Ctx, nextIndex: number): void {
  ctx.state = { ...ctx.state, mainScheme: { ...ctx.state.mainScheme, stageIndex: nextIndex } };
  const stage = mainSchemeStage(ctx.state);
  const schemeId = ctx.state.mainScheme.instanceId;
  updateInstance(ctx, schemeId, (i) => ({ ...i, threat: 0 }));
  emit(ctx, { type: "mainSchemeAdvanced", stageIndex: nextIndex });
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, stage.aSide.abilities, ctx.state.firstPlayerId),
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, {
      kind: "placeThreat",
      schemeInstanceId: schemeId,
      amount: scale(stage.startingThreat, ctx.state.startingPlayerCount),
      sourceInstanceId: null,
    }),
    eventFrame(ctx, { kind: "mainSchemeAdvanced", stageIndex: nextIndex }),
  ]);
}

/** The damage that triggered a defeat sweep, so that character's defeat can carry attack context. */
interface DefeatHint {
  readonly targetId: InstanceId;
  readonly parentFrameId: FrameId | null;
  readonly overkill: { readonly amount: number; readonly toInstanceId: InstanceId; readonly sourceInstanceId: InstanceId | null } | undefined;
  /** The controller of the damage's source ("after you defeat a minion"). */
  readonly defeatedByPlayerId?: PlayerId | null;
}

const defeatPending = (state: GameState, id: InstanceId): boolean =>
  state.stack.some(
    (f) => f.kind === "event" && f.event.kind === "characterDefeated" && f.event.instanceId === id && (f.stage === "interrupts" || f.stage === "apply"),
  );

/** Sweeps every character in play for zero remaining hit points, in a fixed order. */
export function checkDefeats(ctx: Ctx, hint?: DefeatHint): void {
  if (ctx.state.outcome) return;

  const villainId = ctx.state.villain.instanceId;
  const villainProfile = characterProfile(ctx.state, villainId, ctx.deps);
  const villain = getInstance(ctx.state, villainId);
  if (villainProfile && villain && villain.damage >= villainProfile.maxHp) {
    defeatVillainStage(ctx);
    if (ctx.state.outcome) return;
  }

  // One batch for the whole sweep, in sweep order. Each defeat is an event with
  // an interrupt window; the card leaves play when it applies (see applyDefeat).
  const defeatFrames: StackFrame[] = [];
  for (const player of playerOrder(ctx.state)) {
    for (const id of [...player.playArea]) {
      const profile = characterProfile(ctx.state, id, ctx.deps);
      const instance = getInstance(ctx.state, id);
      if (!profile || !instance) continue;
      if (profile.kind !== "ally" && profile.kind !== "minion") continue;
      if (instance.damage < profile.maxHp) continue;
      if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) continue;
      if (defeatPending(ctx.state, id)) continue;
      const context =
        hint?.targetId === id
          ? {
              parentFrameId: hint.parentFrameId,
              ...(hint.overkill ? { overkill: hint.overkill } : {}),
              ...(hint.defeatedByPlayerId ? { defeatedByPlayerId: hint.defeatedByPlayerId } : {}),
            }
          : {};
      defeatFrames.push(eventFrame(ctx, { kind: "characterDefeated", instanceId: id, ...context }));
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
  if (nextIndex > ctx.state.villain.lastStageIndex || nextIndex >= villainStageCount(ctx.state)) {
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
  const villainId = ctx.state.villain.instanceId;
  updateInstance(ctx, villainId, (i) => ({ ...i, damage: 0 }));
  emit(ctx, { type: "villainStageAdvanced", stageIndex: nextIndex });
  // RRG "Villain Defeat": the next stage is revealed. Same title in Core, so statuses and
  // attachments carry over; the new stage's keywords (toughness) and When Revealed apply.
  if (hasKeyword(ctx.state, villainId, "toughness", ctx.deps)) giveStatus(ctx, villainId, "tough");
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, villainId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
    eventFrame(ctx, { kind: "villainStageAdvanced", stageIndex: nextIndex }),
  ]);
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
    if (hasKeyword(ctx.state, id, "permanent", ctx.deps)) continue;
    if (isMinion(ctx.state, id) && nextSeat) {
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
  for (const id of [...mustPlayer(ctx.state, playerId).resolving]) {
    moveCard(ctx, id, { kind: "discard", playerId }, "top");
  }

  updatePlayer(ctx, playerId, (p) => ({ ...p, eliminated: true }));
  emit(ctx, { type: "playerEliminated", playerId });

  if (ctx.state.players.every((p) => p.eliminated)) {
    endGame(ctx, { result: "loss", reason: "allPlayersDefeated" });
  }
}
