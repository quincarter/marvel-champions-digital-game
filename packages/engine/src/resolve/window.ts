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
  playCostModifier,
  priceOrNull,
  pricePlay,
  resourceVars,
} from "../actions.js";
import { inPlayPicksOf } from "../abilities.js";
import type { ChoiceOption } from "../choices.js";
import type { CostChoices } from "../commands.js";
import { type Ctx, emit, findFrame, popFrame, pushFrames, requestChoice, setFrame } from "../ctx.js";
import { costReductionFor } from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { cardOf, mustCardOf, mustPlayer, playerOrder } from "../query.js";
import { combineRequirements, requirementTotal, satisfies } from "../resources.js";
import type { TriggerCandidate, WindowTiming } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { simultaneousOrderer } from "../villain/authority.js";
import { abilityFrame, base, type Frame } from "./frames.js";
import { pushPlayCardFrame } from "./play-card.js";
import { candidatesFor } from "./triggers.js";

export function pushWindow(ctx: Ctx, event: TriggerEvent, timing: WindowTiming, eventFrameId: FrameId | null): void {
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

/** RRG "Ability — Simultaneous Timing Priority": forced abilities before non-forced. */
const TIERS: readonly boolean[] = [true, false];

export function executeWindowFrame(ctx: Ctx, frame: Frame<"window">): void {
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
    if (askCostPick(ctx, frame, next, rest)) return;
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
      playerId: simultaneousOrderer(ctx.state),
      authority: "firstPlayerOrders",
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

export const candidateOption =
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
    if (candidates.length <= pick.min) continue;
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
    costPicks: { key: candidateKey(candidate), choices: { ...costChoicesFor(frame, candidate), [pick.slot]: picked } },
  });
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
  const plan = planCost(
    ctx.state,
    ctx.deps,
    candidate.instanceId,
    controller,
    definition.cost,
    costChoicesFor(frame, candidate),
    new Set(),
  );
  if (isPriceFault(plan)) return;
  const needed = requirementTotal(plan.requirement);
  // An "X" cost ("spend up to 3 resources", Machine Man) totals 0 fixed resources but is still the player's decision
  // (the same guard `requestWindowPayment` has; docs/phase7-wave4.md §3.36).
  if (needed > 0 || definition.cost.resourcesX !== undefined) {
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
  const plan = planCost(
    ctx.state,
    ctx.deps,
    candidate.instanceId,
    controller,
    definition.cost,
    costChoicesFor(frame, candidate),
    new Set(),
  );
  if (isPriceFault(plan)) return;
  const pool = priceOrNull(ctx, controller, payment, null, plan.payingFor);
  if (!pool || !satisfies(pool, plan.requirement)) return;
  // The same checks and vars an action's payment gets: "of the same type" / "of different types", X
  // (docs/phase7-wave3.md §3.43). A payment that fails one is a decline, as an under-payment is.
  const paidVars = resourceVars(pool, plan.cost ?? definition.cost, plan.requirement);
  if (isPriceFault(paidVars)) return;
  const spent = payPayment(ctx, controller, payment);
  pushFrames(ctx, [
    abilityFrame(ctx, candidate, frame.event, frame.eventFrameId, plan.bindings, { ...plan.vars, ...paidVars }),
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
  const priced = pricePlay(
    ctx,
    controller,
    candidate.instanceId,
    abilityCost,
    payment,
    costChoicesFor(frame, candidate),
  );
  if (isPriceFault(priced)) return;
  const spent = commitPlay(ctx, controller, candidate.instanceId, payment, priced);
  pushPlayCardFrame(
    ctx,
    candidate.instanceId,
    controller,
    null,
    { triggeredAbilityId: candidate.abilityId, event: frame.event, eventFrameId: frame.eventFrameId },
    { bindings: priced.plan.bindings, vars: priced.vars },
  );
  payCost(ctx, candidate.instanceId, controller, abilityCost, priced.plan);
  announceResourcesSpent(ctx, controller, spent, candidate.instanceId, "playCard");
}

function absorbWindowAnswer(ctx: Ctx, frame: Frame<"window">, answer: readonly string[]): void {
  if (frame.awaiting === "costPick") return absorbCostPick(ctx, frame, answer, frame.costPicks?.asking ?? null);
  if (frame.awaiting === "pay") {
    return frame.paying?.fromHand === false
      ? payWindowAbility(ctx, frame, answer)
      : playWindowEvent(ctx, frame, answer);
  }
  const byOption = new Map(frame.pending.map((c) => [`${c.instanceId}:${c.abilityId}`, c]));
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
