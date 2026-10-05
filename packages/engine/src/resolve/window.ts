/** Timing windows: ordering, choosing, paying for and resolving triggered abilities. */

import {
  announceResourcesSpent,
  commitPlay,
  inPlayCostCandidates,
  isPriceFault,
  payCost,
  paymentOptions,
  paymentsFromOptionIds,
  payPayment,
  planCost,
  playableFromAttachment,
  playCostModifier,
  priceOrNull,
  pricePlay,
  resourceVars,
  upToCounterChoice,
} from "../actions.js";
import { inPlayPicksOf } from "../abilities.js";
import type { ChoiceOption } from "../choices.js";
import type { CostChoices, CostSelection } from "../commands.js";
import { type Ctx, emit, findFrame, popFrame, pushFrames, requestChoice, setFrame, updateFrame } from "../ctx.js";
import { costReductionFor } from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { cardOf, deckDiscardStillThere, mustCardOf, mustPlayer, playerOrder, printedCostOf } from "../query.js";
import { combineRequirements, requirementTotal, satisfies } from "../resources.js";
import type { TriggerCandidate, WindowTiming } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { simultaneousOrderer } from "../villain/authority.js";
import { limitReached } from "./ability.js";
import { abilityFrame, base, type Frame } from "./frames.js";
import { pushPlayCardFrame } from "./play-card.js";
import { activeAbilityRefs, cardsInPlay } from "../select.js";
import { keywordAbilityOf } from "../keyword-abilities.js";
import { candidatesFor, stillOffered } from "./triggers.js";

export function pushWindow(
  ctx: Ctx,
  event: TriggerEvent,
  timing: WindowTiming,
  eventFrameId: FrameId | null,
  /** Other triggering conditions of the same occurrence sharing this window (RRG 1.8 p. 45; `Frame<"window">`). */
  alsoEvents: readonly TriggerEvent[] = [],
  /** Their event frames, by index, when they are still to apply (a shared interrupt window). */
  alsoEventFrameIds: readonly (FrameId | null)[] = [],
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "window",
      event,
      ...(alsoEvents.length > 0 ? { alsoEvents } : {}),
      ...(alsoEventFrameIds.some((id) => id !== null) ? { alsoEventFrameIds } : {}),
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

/** RRG "Ability — Simultaneous Timing Priority": forced abilities before non-forced. */
const TIERS: readonly boolean[] = [true, false];

/**
 * One tier's candidates: those of every condition sharing the window (`alsoEvents`, in the order they resolved), then
 * the window's own event's. RRG 1.8 "Triggering Condition" (p. 45): abilities that refer to any of the conditions one
 * occurrence created "may be used in any order" in its single window, so each tier spans all of them (p. 5).
 */
function windowCandidates(ctx: Ctx, frame: Frame<"window">, forced: boolean): readonly TriggerCandidate[] {
  const shared = (frame.alsoEvents ?? []).flatMap((event, index) =>
    candidatesFor(ctx.state, ctx.deps, event, frame.timing, forced).map((candidate): TriggerCandidate => ({
      ...candidate,
      sharedEvent: { index, event },
    })),
  );
  return [...shared, ...candidatesFor(ctx.state, ctx.deps, frame.event, frame.timing, forced)].filter((candidate) =>
    stillImminent(ctx, frame, candidate),
  );
}

/**
 * The condition a candidate answers, and its event frame: for a shared condition, its own frame while it is still to
 * apply (a shared interrupt window, `alsoEventFrameIds`), else none (its frame has finished).
 */
const answered = (frame: Frame<"window">, candidate: TriggerCandidate) =>
  candidate.sharedEvent
    ? {
        event: candidate.sharedEvent.event,
        eventFrameId: frame.alsoEventFrameIds?.[candidate.sharedEvent.index] ?? null,
      }
    : { event: frame.event, eventFrameId: frame.eventFrameId };

/** Whether the event frame `frameId` names has been cancelled or replaced by an interrupt (RRG "Interrupt"). */
const cancelledFrame = (ctx: Ctx, frameId: FrameId | null): boolean => {
  const found = frameId ? findFrame(ctx.state, frameId) : undefined;
  return found?.kind === "event" && found.cancelled;
};

/**
 * RRG "Interrupt": once an interrupt cancels or replaces the imminent event, no further interrupts to it can be
 * triggered. In an interrupt window several events share (docs/phase7-wave5.md §4.1 Q33), that holds per event: the
 * others' interrupts still resolve.
 */
const stillImminent = (ctx: Ctx, frame: Frame<"window">, candidate: TriggerCandidate): boolean => {
  if (frame.timing !== "interrupt") return true;
  const on = answered(frame, candidate);
  if (cancelledFrame(ctx, on.eventFrameId)) return false;
  // An attachment leaving with its host (§4.1 Q32): not if the host's own event here was cancelled and the host stays.
  // An attachment's attachment asks the same of its host's host, and so on up (§4.1 Q50).
  const events = [frame.event, ...(frame.alsoEvents ?? [])];
  const frames = [frame.eventFrameId, ...(frame.alsoEventFrameIds ?? [])];
  let leaving = on.event.kind === "cardLeavesPlay" ? on.event.leaving : undefined;
  while (leaving?.kind === "withHost") {
    const host = leaving.host;
    const hostAt = events.findIndex((event) => "instanceId" in event && event.instanceId === host);
    if (hostAt < 0) return true;
    if (cancelledFrame(ctx, frames[hostAt] ?? null)) return !cardsInPlay(ctx.state).includes(host);
    const hostEvent = events[hostAt];
    leaving = hostEvent?.kind === "cardLeavesPlay" ? hostEvent.leaving : undefined;
  }
  return true;
};

/**
 * A candidate's option id: `<instanceId>:<abilityId>`, with `@<n>` for the n-th shared condition when the same ability
 * also answers another condition in the window (`among`), so one ability answering two conditions of the same
 * occurrence is two options. An ability answering only a shared condition keeps the plain id ("When you engage a
 * minion" in a minion's enters-play window, `engagingAsItEnters`), so an option reads the same whichever window
 * carries its condition. `among` is the window's whole candidate list, both when asking and when reading the answer.
 */
const optionIdOf = (candidate: TriggerCandidate, among: readonly TriggerCandidate[] = []): string => {
  const plain = `${candidate.instanceId}:${candidate.abilityId}`;
  if (!candidate.sharedEvent) return plain;
  const twinned = among.some(
    (other) =>
      other !== candidate && other.instanceId === candidate.instanceId && other.abilityId === candidate.abilityId,
  );
  return twinned ? `${plain}@${candidate.sharedEvent.index}` : plain;
};

export function executeWindowFrame(ctx: Ctx, frame: Frame<"window">): void {
  if (frame.answer) return absorbWindowAnswer(ctx, frame, frame.answer);
  // RRG "Interrupt": once an interrupt cancels or replaces the imminent event,
  // no further interrupts to it can be triggered (in a shared window: once every event it shares is).
  if (
    frame.timing === "interrupt" &&
    cancelledFrame(ctx, frame.eventFrameId) &&
    (frame.alsoEventFrameIds ?? []).every((id) => id === null || cancelledFrame(ctx, id))
  ) {
    popFrame(ctx);
    return;
  }
  if (frame.askingPlayerIds.length > 0) return askNextController(ctx, frame);
  if (frame.queue.length > 0) {
    const [next, ...rest] = frame.queue;
    if (!next) throw new EngineInvariantError("empty trigger queue");
    // Its event was cancelled or replaced by an interrupt that resolved first (a shared window, §4.1 Q33 of wave 5).
    if (!stillImminent(ctx, frame, next)) return setFrame(ctx, { ...frame, queue: rest });
    // A response to a card's discard from a deck, chosen before an earlier response in the queue moved that card: it
    // has nothing left to act on, and is not initiated (docs/phase7-wave7.md §3.55).
    const answering = answered(frame, next).event;
    if (answering.kind === "cardDiscardedFromDeck" && !deckDiscardStillThere(ctx.state, answering))
      return setFrame(ctx, { ...frame, queue: rest });
    if (askCostPick(ctx, frame, next, rest)) return;
    if (askCostCounters(ctx, frame, next, rest)) return;
    if (next.fromHand) return requestWindowPayment(ctx, frame, next, rest);
    return triggerCandidate(ctx, { ...frame, queue: rest }, next);
  }
  const forced = TIERS[frame.tierIndex];
  if (forced === undefined) {
    popFrame(ctx);
    return;
  }
  // The window's candidates are those whose triggering condition this occurrence met, read once as it opens, forced
  // and optional together (docs/phase7-wave6.md §3.79). An optional one is still dropped if a forced ability left it
  // unable to be initiated (it left play, lost its text, its cost or target is gone: `stillOffered`), but an ability
  // the forced tier switched on is not offered for an occurrence it did not hear.
  const atOpen = frame.tierIndex === 0 ? windowCandidates(ctx, frame, false) : undefined;
  const candidates = forced
    ? windowCandidates(ctx, frame, true)
    : (frame.optionalAtOpen ?? windowCandidates(ctx, frame, false)).filter(
        (candidate) =>
          stillImminent(ctx, frame, candidate) &&
          stillOffered(ctx.state, ctx.deps, candidate, answered(frame, candidate).event),
      );
  const advanced = {
    ...frame,
    tierIndex: frame.tierIndex + 1,
    pending: candidates,
    ...(atOpen ? { optionalAtOpen: atOpen } : {}),
  };
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
    if (candidates.length === 1 || interchangeable(ctx, candidates)) {
      setFrame(ctx, { ...advanced, queue: candidates, pending: [] });
      return;
    }
    // RRG "Forced"/"Simultaneous Resolution": the first player orders simultaneous effects.
    setFrame(ctx, { ...advanced, awaiting: "order" });
    requestChoice(ctx, {
      playerId: simultaneousOrderer(ctx.state),
      authority: "firstPlayerOrders",
      prompt: { kind: "orderTriggers", event: frame.event, timing: frame.timing },
      options: candidates.map(candidateOption(ctx.state, candidates)),
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

/**
 * Simultaneous forced effects whose order cannot matter are not worth asking about (RRG 1.8 "Simultaneous Resolution",
 * p. 45, lets the first player order effects, which is a decision only where the order can change something): the same
 * engine keyword ability (two Temporary upgrades discarded as the round ends) on cards none of which answers leaving
 * play. Each is the same discard of a different card; with no leaves-play ability on any of them, neither can
 * react to the other leaving first, so every order ends in the same state (QA playthrough B, QB-8). Any other mix, or a
 * card with a leaves-play ability of its own, still asks.
 */
function interchangeable(ctx: Ctx, candidates: readonly TriggerCandidate[]): boolean {
  const first = candidates[0];
  if (!first || !keywordAbilityOf(first.abilityId)) return false;
  return candidates.every(
    (candidate) =>
      candidate.abilityId === first.abilityId &&
      !candidate.sharedEvent &&
      !activeAbilityRefs(ctx.state, candidate.instanceId, ctx.deps).some((ref) => {
        const trigger = ctx.deps.abilities[ref.id]?.trigger;
        if (!trigger || (trigger.kind !== "interrupt" && trigger.kind !== "response")) return false;
        const kinds = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
        return kinds.some((kind) => LEAVE_PLAY_KINDS.has(kind));
      }),
  );
}

/** The events a card's own ability can answer when it, or another card, leaves play. */
const LEAVE_PLAY_KINDS: ReadonlySet<string> = new Set(["cardLeavesPlay", "defeat", "discardFromPlay"]);

export const candidateOption =
  (state: GameState, among: readonly TriggerCandidate[] = []) =>
  (candidate: TriggerCandidate): ChoiceOption => ({
    optionId: optionIdOf(candidate, among),
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
  const mine = frame.pending.filter(
    (c) => (c.controllerId ?? ctx.state.firstPlayerId) === current && stillImminent(ctx, frame, c),
  );
  if (mine.length === 0) {
    setFrame(ctx, { ...frame, askingPlayerIds: rest });
    return;
  }
  setFrame(ctx, { ...frame, awaiting: "select" });
  requestChoice(ctx, {
    playerId: current,
    prompt: { kind: "chooseTriggers", event: frame.event, timing: frame.timing },
    options: mine.map(candidateOption(ctx.state, frame.pending)),
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
  const printed = printedCostOf(ctx.state, card);
  // A card played straight from hand at its own trigger window (Crosscounter, Knife Leap, …) is priced the same
  // way `ownPlayCost` prices a normally-played card: printed cost, then every in-play/hand-active `CostModifierSpec`
  // constant (`playCostModifier` — this path previously read only `costReductionFor`'s older "reduce the next card"
  // lasting-effect mechanism, so a constant cost reduction like Knife Leap's "reduce the cost to play this card by
  // 1 for each vengeance counter on Drax" silently never applied here), then the older reduction, never below 0.
  const modified = Math.max(
    0,
    printed + playCostModifier(ctx.state, ctx.deps, candidate.controllerId, candidate.instanceId, null),
  );
  const reduced = Math.max(
    0,
    modified - costReductionFor(ctx.state, ctx.deps, candidate.controllerId, candidate.instanceId),
  );
  const abilityCost = ctx.deps.abilities[candidate.abilityId]?.cost?.resources;
  return requirementTotal(combineRequirements(reduced, abilityCost));
}

const candidateKey = (candidate: TriggerCandidate): string => `${candidate.instanceId}:${candidate.abilityId}`;

/** The cards in play the player has picked for this candidate's cost so far (`Frame<"window">.costPicks`). */
function costChoicesFor(frame: Frame<"window">, candidate: TriggerCandidate): CostChoices {
  return frame.costPicks?.key === candidateKey(candidate) ? frame.costPicks.choices : {};
}

/** The count the player chose for this candidate's "up to N" counter cost, as an action's `costSelection` (§3.53). */
function costSelectionFor(frame: Frame<"window">, candidate: TriggerCandidate): CostSelection {
  const counters = frame.costPicks?.key === candidateKey(candidate) ? frame.costPicks.counters : undefined;
  return counters === undefined ? {} : { counters };
}

/**
 * The chosen count is spent once the candidate is paid for (or the payment is declined): a later use of the same
 * ability in this window is asked again rather than reusing it.
 */
function spendCostCounters(ctx: Ctx, frame: Frame<"window">): void {
  if (frame.costPicks?.counters === undefined) return;
  updateFrame(ctx, frame.frameId, (current) => {
    if (current.kind !== "window" || !current.costPicks) return current;
    const { counters: _spent, ...picks } = current.costPicks;
    return { ...current, costPicks: picks };
  });
}

/**
 * Asks the candidate's controller how many counters its "up to N" counter cost removes (`chooseCostCounters`;
 * docs/phase7-wave6.md §3.53: Throw de Card's "remove up to 3 charge counters from here →"), once its cost cards are
 * picked and before its payment: RRG 1.8 "Initiating Abilities" (p. 24), the cost is determined (step 3) before it is
 * paid (step 5), as an action's `costSelection.counters` is chosen up front. Not asked when there is no choice (one
 * counter at most); a cost that cannot be paid at all is refused by `planCost` when the candidate is triggered.
 *
 * The options run from the most down to 1, so a driver taking the first option removes as many as it can, which is
 * what a window did before it asked.
 */
function askCostCounters(
  ctx: Ctx,
  frame: Frame<"window">,
  candidate: TriggerCandidate,
  rest: readonly TriggerCandidate[],
): boolean {
  const controller = candidate.controllerId;
  const cost = ctx.deps.abilities[candidate.abilityId]?.cost;
  if (!controller || !cost) return false;
  if (costSelectionFor(frame, candidate).counters !== undefined) return false;
  const choices = costChoicesFor(frame, candidate);
  const choice = upToCounterChoice(ctx.state, ctx.deps, candidate.instanceId, controller, cost, choices);
  if (!choice || choice.max <= 1) return false;
  setFrame(ctx, {
    ...frame,
    queue: rest,
    awaiting: "costCounters",
    paying: candidate,
    costPicks: { key: candidateKey(candidate), choices },
  });
  const counts = Array.from({ length: choice.max }, (_, i) => choice.max - i);
  requestChoice(ctx, {
    playerId: controller,
    prompt: {
      kind: "chooseCostCounters",
      instanceId: candidate.instanceId,
      abilityId: candidate.abilityId,
      counterType: choice.counterType,
      min: 1,
      max: choice.max,
    },
    options: counts.map((count) => ({
      optionId: String(count),
      label: `Remove ${count} ${choice.counterType} counter${count === 1 ? "" : "s"}`,
      ref: { kind: "none" } as const,
    })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
  return true;
}

/** The answer to a `chooseCostCounters` choice: record the count and put the candidate back at the head of the queue. */
function absorbCostCounters(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  const candidate = frame.paying;
  const cleared = { ...frame, answer: null, awaiting: null, paying: null };
  const count = Number(answer[0]);
  // The choice offered only whole counts from 1 to the most removable (`resolveChoice` refuses any other option id).
  if (!candidate || !Number.isInteger(count) || count < 1) return setFrame(ctx, cleared);
  setFrame(ctx, {
    ...cleared,
    queue: [candidate, ...frame.queue],
    costPicks: { key: candidateKey(candidate), choices: costChoicesFor(frame, candidate), counters: count },
  });
}

/**
 * Asks the candidate's controller for the next cost pick of cards in play that is their choice, if one is left
 * (docs/phase7-wave4.md §3.17: Stand Together's "exhaust an [Avenger] character and a [Guardian] character" played
 * inside an interrupt window). RRG 1.8 "Initiating Abilities" (p. 24): the costs are determined (step 3) before they
 * are paid (step 5), so every pick is made before the payment sheet. A forced pick (exactly `min` candidates) and a pick
 * with too few candidates are not asked; `planCost` pays the one and refuses the other.
 */
function askCostPick(
  ctx: Ctx,
  frame: Frame<"window">,
  candidate: TriggerCandidate,
  rest: readonly TriggerCandidate[],
): boolean {
  const controller = candidate.controllerId;
  const cost = ctx.deps.abilities[candidate.abilityId]?.cost;
  if (!controller || !cost) return false;
  const choices = costChoicesFor(frame, candidate);
  const taken = new Set(Object.values(choices).flat());
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    if (choices[pick.slot] !== undefined) continue;
    const candidates = inPlayCostCandidates(ctx.state, ctx.deps, candidate.instanceId, controller, mode, pick).filter(
      (id) => !taken.has(id),
    );
    // An `each` pick takes every matching card (`InPlayCostPick.each`): nothing to ask.
    if (pick.each || candidates.length <= pick.min) continue;
    setFrame(ctx, {
      ...frame,
      queue: rest,
      awaiting: "costPick",
      paying: candidate,
      costPicks: { key: candidateKey(candidate), choices, asking: pick.slot },
    });
    requestChoice(ctx, {
      playerId: controller,
      prompt: {
        kind: "chooseCostCards",
        instanceId: candidate.instanceId,
        abilityId: candidate.abilityId,
        slot: pick.slot,
        mode,
      },
      options: candidates.map((id) => ({
        optionId: id,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "card", instanceId: id },
      })),
      minSelections: 0,
      maxSelections: Math.min(candidates.length, pick.max ?? candidates.length),
      frameId: frame.frameId,
    });
    return true;
  }
  return false;
}

/**
 * The answer to a `chooseCostCards` choice: record the pick and put the candidate back at the head of the queue, so the
 * next pick (or its payment) is asked. Fewer than the pick's `min` backs out of the candidate.
 */
function absorbCostPick(ctx: Ctx, frame: Frame<"window">, answer: readonly string[], slot: string | null): void {
  const candidate = frame.paying;
  const { costPicks: _dropped, ...cleared } = { ...frame, answer: null, awaiting: null, paying: null };
  const pick = candidate
    ? inPlayPicksOf(ctx.deps.abilities[candidate.abilityId]?.cost).find((entry) => entry.pick.slot === slot)?.pick
    : undefined;
  if (!candidate || !pick || answer.length < pick.min) return setFrame(ctx, cleared);
  const picked = answer.map((id) => id as InstanceId);
  setFrame(ctx, {
    ...cleared,
    queue: [candidate, ...frame.queue],
    costPicks: {
      key: candidateKey(candidate),
      choices: { ...costChoicesFor(frame, candidate), [pick.slot]: picked },
      ...costSelectionFor(frame, candidate),
    },
  });
}

/**
 * Resolves the next queued candidate, paying its cost first (RRG "Cost"). A
 * cost that can no longer be paid means the ability doesn't resolve; a cost
 * with resources asks the controller to pay (and they may decline).
 */
function triggerCandidate(ctx: Ctx, frame: Frame<"window">, candidate: TriggerCandidate): void {
  setFrame(ctx, frame);
  // Read now and spent unless a payment is asked for, which reads it again (`payWindowAbility`).
  const selection = costSelectionFor(frame, candidate);
  spendCostCounters(ctx, frame);
  const on = answered(frame, candidate);
  const definition = ctx.deps.abilities[candidate.abilityId];
  const controller = candidate.controllerId;
  // RRG 1.8 "Limit" (pp. 26–27): an ability at its limit cannot be initiated, so its cost is not paid. Two players may
  // both pick an ability any of them may trigger (`triggerableBy`, docs/phase7-wave6.md §3.11); the second finds the
  // card's limit spent by the first.
  if (
    definition &&
    limitReached(ctx.state, candidate.instanceId, candidate.abilityId, definition, on.event, controller)
  ) {
    return;
  }
  if (!definition?.cost || !controller) {
    pushFrames(ctx, [abilityFrame(ctx, candidate, on.event, on.eventFrameId)]);
    return;
  }
  const plan = planCost(
    ctx.state,
    ctx.deps,
    candidate.instanceId,
    controller,
    definition.cost,
    costChoicesFor(frame, candidate),
    new Set(),
    selection,
  );
  if (isPriceFault(plan)) return;
  const needed = requirementTotal(plan.requirement);
  // An "X" cost ("spend up to 3 resources", Machine Man) totals 0 fixed resources but is still the player's decision
  // (the same guard `requestWindowPayment` has; docs/phase7-wave4.md §3.36).
  if (needed > 0 || definition.cost.resourcesX !== undefined) {
    const options = paymentOptions(ctx, controller, null, plan.payingFor ?? candidate.instanceId);
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
  pushFrames(ctx, [abilityFrame(ctx, candidate, on.event, on.eventFrameId, plan.bindings, plan.vars)]);
  payCost(ctx, candidate.instanceId, controller, definition.cost, plan);
}

/** The answer to a `payForAbility` choice: pay and resolve, or decline by under-paying. */
function payWindowAbility(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  const candidate = frame.paying;
  setFrame(ctx, { ...frame, answer: null, awaiting: null, paying: null });
  const selection = candidate ? costSelectionFor(frame, candidate) : {};
  spendCostCounters(ctx, frame);
  const controller = candidate?.controllerId;
  const definition = candidate ? ctx.deps.abilities[candidate.abilityId] : undefined;
  if (!candidate || !controller || !definition) return;
  const on = answered(frame, candidate);
  const payment = paymentsFromOptionIds(answer);
  const plan = planCost(
    ctx.state,
    ctx.deps,
    candidate.instanceId,
    controller,
    definition.cost,
    costChoicesFor(frame, candidate),
    new Set(),
    selection,
  );
  if (isPriceFault(plan)) return;
  // Paid for the ability's card unless its cost picks one, as an action ability's is (`useAbility`).
  const payingFor = plan.payingFor ?? candidate.instanceId;
  const pool = priceOrNull(ctx, controller, payment, null, payingFor);
  if (!pool || !satisfies(pool, plan.requirement)) return;
  // The same checks and vars an action's payment gets: "of the same type" / "of different types", X
  // (docs/phase7-wave3.md §3.43). A payment that fails one is a decline, as an under-payment is.
  const paidVars = resourceVars(pool, plan.cost ?? definition.cost, plan.requirement);
  if (isPriceFault(paidVars)) return;
  const spent = payPayment(ctx, controller, payment, payingFor);
  pushFrames(ctx, [
    abilityFrame(ctx, candidate, on.event, on.eventFrameId, plan.bindings, { ...plan.vars, ...paidVars }),
  ]);
  payCost(ctx, candidate.instanceId, controller, definition.cost, plan);
  announceResourcesSpent(ctx, controller, spent, candidate.instanceId, "ability");
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
  // RRG 1.8 "Max, Maximum" (p. 28), "Max 1 per [instance]": two copies of a "(Max 1 per attack.)" event picked together
  // for one attack are one play; the second stays in hand, its cost unpaid (docs/phase7-wave7.md §3.69).
  const limited = ctx.deps.abilities[candidate.abilityId];
  if (
    limited &&
    limitReached(
      ctx.state,
      candidate.instanceId,
      candidate.abilityId,
      limited,
      answered(frame, candidate).event,
      controller,
    )
  ) {
    setFrame(ctx, { ...frame, queue: rest });
    return;
  }
  const cost = windowEventCost(ctx, candidate);
  /**
   * A free card is not a decision. Play it.
   *
   * The player already opted in: `frame.queue` is filled only from what they
   * picked in the `chooseTriggers` choice, so the payment step is a *second*
   * question, and "select nothing to back out" has nothing to select when the
   * cost is zero — it renders as an empty sheet with Confirm/Decline over a
   * card like Great Responsibility. `triggerCandidate` above already
   * short-circuits at zero for an in-play ability; this path simply never did,
   * so the same free ability was silent from one route and prompted from the
   * other. Declining is still possible, at the `chooseTriggers` step where it
   * belongs.
   */
  // `windowEventCost` totals the *fixed* requirement only, so an "X" cost reads
  // as 0 while the player still has a real decision to make about how much to
  // spend (docs/phase2-core-set.md §3: X counts every resource in the payment
  // beyond the fixed cost). Never skip the sheet for one of those.
  const hasXCost = ctx.deps.abilities[candidate.abilityId]?.cost?.resourcesX !== undefined;
  if (cost === 0 && !hasXCost) {
    const playing = { ...frame, queue: rest, paying: candidate };
    setFrame(ctx, playing);
    playWindowEvent(ctx, playing, []);
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
      cost,
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
 * little) is how a player backs out — the card stays in hand (or on its host). `commitPlay` moves a played
 * attached event off its host to resolve, faceup.
 */
function playWindowEvent(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  const candidate = frame.paying;
  setFrame(ctx, { ...frame, answer: null, awaiting: null, paying: null });
  const selection = candidate ? costSelectionFor(frame, candidate) : {};
  spendCostCounters(ctx, frame);
  const controller = candidate?.controllerId;
  if (!candidate || !controller) return;
  // Still in hand, or still on a host that lets it be played "as if it were in your hand" (`inHandCandidates`).
  if (
    !mustPlayer(ctx.state, controller).hand.includes(candidate.instanceId) &&
    !playableFromAttachment(ctx.state, ctx.deps, controller, candidate.instanceId)
  )
    return;
  const payment = paymentsFromOptionIds(answer);
  const abilityCost = ctx.deps.abilities[candidate.abilityId]?.cost;
  const priced = pricePlay(
    ctx,
    controller,
    candidate.instanceId,
    abilityCost,
    payment,
    costChoicesFor(frame, candidate),
    null,
    undefined,
    0,
    selection,
  );
  if (isPriceFault(priced)) return;
  const spent = commitPlay(ctx, controller, candidate.instanceId, payment, priced);
  pushPlayCardFrame(
    ctx,
    candidate.instanceId,
    controller,
    null,
    { triggeredAbilityId: candidate.abilityId, ...answered(frame, candidate) },
    { bindings: priced.plan.bindings, vars: priced.vars },
  );
  payCost(ctx, candidate.instanceId, controller, abilityCost, priced.plan);
  announceResourcesSpent(ctx, controller, spent, candidate.instanceId, "playCard");
}

function absorbWindowAnswer(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  if (frame.awaiting === "costPick") return absorbCostPick(ctx, frame, answer, frame.costPicks?.asking ?? null);
  if (frame.awaiting === "costCounters") return absorbCostCounters(ctx, frame, answer);
  if (frame.awaiting === "pay") {
    return frame.paying?.fromHand === false
      ? payWindowAbility(ctx, frame, answer)
      : playWindowEvent(ctx, frame, answer);
  }
  // A player answering `chooseTriggers` picks among their own offers: an ability several players may trigger
  // (`triggerableBy`, docs/phase7-wave6.md §3.11) is one option id per player offered it.
  const asking = frame.awaiting === "order" ? null : (frame.askingPlayerIds[0] ?? null);
  const answerable = frame.pending.filter(
    (c) => asking === null || (c.controllerId ?? ctx.state.firstPlayerId) === asking,
  );
  const byOption = new Map(answerable.map((c) => [optionIdOf(c, frame.pending), c]));
  const picked = answer.map((optionId) => byOption.get(optionId)).filter((c): c is TriggerCandidate => c !== undefined);
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
