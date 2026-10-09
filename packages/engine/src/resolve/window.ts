/** Timing windows: ordering, choosing, paying for and resolving triggered abilities. */

import {
  announceResourcesSpent,
  commitPlay,
  handCardsIn,
  handDiscardCandidates,
  playFrameCost,
  inPlayCostCandidates,
  isPriceFault,
  payCost,
  paymentOptions,
  paymentsFromOptionIds,
  payPayment,
  costResourceRequirement,
  planCost,
  deckTopCostReduction,
  deckTopPlayOf,
  playableFromAttachment,
  playCostModifier,
  priceOrNull,
  pricePlay,
  resourceVars,
  settleAbilityPaidTypes,
  logAbilityWildTypes,
  upToCounterChoice,
} from "../actions.js";
import { inPlayPicksOf, resourcesChoiceOf } from "../abilities.js";
import type { ChoiceOption } from "../choices.js";
import type { CostChoices, CostSelection } from "../commands.js";
import { type Ctx, emit, findFrame, popFrame, pushFrames, requestChoice, setFrame, updateFrame } from "../ctx.js";
import { candidateDefenseBar, windowDefenseBar } from "../defense-claim.js";
import { costReductionFor } from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { cardOf, deckDiscardStillThere, mustCardOf, mustPlayer, playerOrder, printedCostOf } from "../query.js";
import { combineRequirements, requirementTotal, satisfies } from "../resources.js";
import type { TriggerCandidate, WindowTiming } from "../stack.js";
import type { EngineDeps } from "../abilities.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { simultaneousOrderer } from "../villain/authority.js";
import { limitReached } from "./ability.js";
import { abilityFrame, base, type Frame } from "./frames.js";
import { pushPlayCardFrame } from "./play-card.js";
import { activeAbilityRefs, cardsInPlay } from "../select.js";
import { keywordAbilityOf } from "../keyword-abilities.js";
import { candidatesFor, hearerKey, hearersOf, stillOffered } from "./triggers.js";

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
      ...(timing === "interrupt" && [event, ...alsoEvents].some((each) => hasWouldCandidates(ctx, each))
        ? { wouldTier: 0 }
        : {}),
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
function windowCandidates(
  ctx: Ctx,
  frame: Frame<"window">,
  forced: boolean,
  would = false,
): readonly TriggerCandidate[] {
  const shared = (frame.alsoEvents ?? []).flatMap((event, index) =>
    candidatesFor(ctx.state, ctx.deps, event, frame.timing, forced).map((candidate): TriggerCandidate => ({
      ...candidate,
      sharedEvent: { index, event },
    })),
  );
  return answeredTogether(
    ctx,
    frame,
    [...shared, ...candidatesFor(ctx.state, ctx.deps, frame.event, frame.timing, forced)].filter(
      (candidate) => isWould(ctx.deps, candidate) === would && stillImminent(ctx, frame, candidate),
    ),
  );
}

/**
 * "After you discard cards" (`EventPattern.together`): an ability whose pattern answers the occurrence once is one
 * candidate however many of the window's conditions match it. The first one's candidate stays, carrying every
 * condition it answers (`TriggerCandidate.together`); the others are dropped.
 */
function answeredTogether(
  ctx: Ctx,
  frame: Frame<"window">,
  candidates: readonly TriggerCandidate[],
): readonly TriggerCandidate[] {
  const kept: TriggerCandidate[] = [];
  const at = new Map<string, number>();
  for (const candidate of candidates) {
    const trigger = ctx.deps.abilities[candidate.abilityId]?.trigger;
    const together = (trigger?.kind === "interrupt" || trigger?.kind === "response") && trigger.on.together === true;
    if (!together) {
      kept.push(candidate);
      continue;
    }
    const key = `${candidate.instanceId}:${candidate.abilityId}`;
    const event = answered(frame, candidate).event;
    const index = at.get(key);
    const first = index === undefined ? undefined : kept[index];
    if (index === undefined || first === undefined) {
      at.set(key, kept.length);
      kept.push({ ...candidate, together: [event] });
    } else kept[index] = { ...first, together: [...(first.together ?? []), event] };
  }
  return kept;
}

/**
 * The optional candidates of an interrupt window that were listening as it opened (`heardAtOpen`), were not offered
 * then or since (`optionalAtOpen`), and can be initiated now: their condition was completed while the window was open.
 * None for a response window, whose occurrence is over, and none until the window has recorded who was listening.
 */
function lateCandidates(ctx: Ctx, frame: Frame<"window">, would: boolean): readonly TriggerCandidate[] {
  if (frame.timing !== "interrupt" || !frame.heardAtOpen || frame.heardAtOpen.length === 0) return [];
  const keyOf = (candidate: TriggerCandidate): string =>
    hearerKey(candidate.instanceId, candidate.abilityId, candidate.sharedEvent?.index);
  const offered = new Set((frame.optionalAtOpen ?? []).map(keyOf));
  const waiting = frame.heardAtOpen.filter((key) => !offered.has(key));
  if (waiting.length === 0) return [];
  const listening = new Set(waiting);
  return windowCandidates(ctx, frame, false, would).filter((candidate) => listening.has(keyOf(candidate)));
}

/** Whether the candidate's interrupt reads "would" (`trigger.would`): the window's earlier tier. */
const isWould = (deps: EngineDeps, candidate: TriggerCandidate): boolean => {
  const trigger = deps.abilities[candidate.abilityId]?.trigger;
  return trigger?.kind === "interrupt" && trigger.would === true;
};

/** The event kinds some `would` interrupt in the registry answers, read once per registry. */
const WOULD_KINDS = new WeakMap<EngineDeps, ReadonlySet<string>>();
const wouldKindsOf = (deps: EngineDeps): ReadonlySet<string> => {
  let kinds = WOULD_KINDS.get(deps);
  if (!kinds) {
    const found = new Set<string>();
    for (const definition of Object.values(deps.abilities)) {
      const trigger = definition.trigger;
      if (trigger.kind !== "interrupt" || trigger.would !== true) continue;
      for (const kind of typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) found.add(kind);
    }
    kinds = found;
    WOULD_KINDS.set(deps, kinds);
  }
  return kinds;
};

/** Whether a `would` interrupt answers this event now, so its window has the earlier tier to run. */
const hasWouldCandidates = (ctx: Ctx, event: TriggerEvent): boolean =>
  wouldKindsOf(ctx.deps).has(event.kind) &&
  [true, false].some((forced) =>
    candidatesFor(ctx.state, ctx.deps, event, "interrupt", forced).some((candidate) => isWould(ctx.deps, candidate)),
  );

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
    // One that answers several discards at once (`EventPattern.together`) still has the others to act on.
    const answering = next.together ?? [answered(frame, next).event];
    if (answering.every((each) => each.kind === "cardDiscardedFromDeck" && !deckDiscardStillThere(ctx.state, each)))
      return setFrame(ctx, { ...frame, queue: rest });
    // Another player defended this attack, or resolved a "(defense)" ability for it, since this one was picked or
    // ordered: it is not initiated and its cost is not paid (RRG 1.8 "Defend, Defense", pp. 14-15).
    if (candidateDefenseBar(ctx.state, ctx.deps, next) !== null) return setFrame(ctx, { ...frame, queue: rest });
    if (askCostPick(ctx, frame, next, rest)) return;
    if (askHandDiscard(ctx, frame, next, rest)) return;
    if (askCostCounters(ctx, frame, next, rest)) return;
    if (next.fromHand) return requestWindowPayment(ctx, frame, next, rest);
    return triggerCandidate(ctx, { ...frame, queue: rest }, next);
  }
  // A player picked some of the optional abilities offered and they have resolved: the window is not declined, so the
  // rest are offered again, to every player with one left (`pickedThisRound`). One that can no longer be initiated
  // (its card is gone, its cost or target is) is dropped, as it is after the forced tier.
  if (frame.pickedThisRound) {
    const { pickedThisRound: _resolved, ...settled } = frame;
    const remaining = frame.pending.filter(
      (candidate) =>
        stillImminent(ctx, frame, candidate) &&
        stillOffered(ctx.state, ctx.deps, candidate, answered(frame, candidate).event),
    );
    if (remaining.length === 0) return setFrame(ctx, { ...settled, pending: [] });
    emit(ctx, {
      type: "windowOpened",
      event: frame.event,
      timing: frame.timing,
      ...(frame.wouldTier !== undefined ? { would: true as const } : {}),
      candidates: remaining.map((c) => ({ instanceId: c.instanceId, abilityId: c.abilityId, forced: c.forced })),
    });
    return setFrame(ctx, { ...settled, pending: remaining, askingPlayerIds: controllersToAsk(ctx.state, remaining) });
  }
  // RRG 1.8 "'Would'" (p. 48): the "would" interrupts are a tier of their own, forced then optional, resolved before
  // the window gathers the event's other interrupts. One that replaced or cancelled the event closed the window above.
  const would = frame.wouldTier !== undefined;
  const tierIndex = frame.wouldTier ?? frame.tierIndex;
  const forced = TIERS[tierIndex];
  if (forced === undefined) {
    // An optional interrupt that resolved may have completed the condition of another that was listening as the
    // window opened (`heardAtOpen`): those are offered now, in a further optional round, until none is new.
    // Nothing optional was offered in this window: nothing optional resolved, so no condition was completed since.
    const late = (frame.optionalAtOpen ?? []).length > 0 ? lateCandidates(ctx, frame, would) : [];
    if (late.length > 0) {
      emit(ctx, {
        type: "windowOpened",
        event: frame.event,
        timing: frame.timing,
        ...(would ? { would: true as const } : {}),
        candidates: late.map((c) => ({ instanceId: c.instanceId, abilityId: c.abilityId, forced: c.forced })),
      });
      setFrame(ctx, {
        ...frame,
        pending: late,
        optionalAtOpen: [...(frame.optionalAtOpen ?? []), ...late],
        askingPlayerIds: controllersToAsk(ctx.state, late),
      });
      return;
    }
    if (would) {
      const { wouldTier: _done, optionalAtOpen: _wouldOptional, heardAtOpen: _wouldHeard, ...rest } = frame;
      setFrame(ctx, rest);
      return;
    }
    popFrame(ctx);
    return;
  }
  // The window's candidates are those whose triggering condition this occurrence met, read once as it opens, forced
  // and optional together (docs/phase7-wave6.md §3.79). An optional one is still dropped if a forced ability left it
  // unable to be initiated (it left play, lost its text, its cost or target is gone: `stillOffered`), but an ability
  // the forced tier switched on is not offered for an occurrence it did not hear. The "would" tiers and the ordinary
  // ones are each read as they open.
  const atOpen = tierIndex === 0 ? windowCandidates(ctx, frame, false, would) : undefined;
  // Interrupt windows: who was listening as it opened (`heardAtOpen`), so a listener whose condition is completed
  // while the window is open can still be offered.
  const heard =
    tierIndex === 0 && frame.timing === "interrupt"
      ? [
          ...(frame.alsoEvents ?? []).flatMap((event, index) =>
            hearersOf(ctx.state, ctx.deps, event, frame.timing, index),
          ),
          ...hearersOf(ctx.state, ctx.deps, frame.event, frame.timing),
        ]
      : undefined;
  // A listener the forced tier completed the condition of joins the optional tier's first round.
  const late = forced ? [] : lateCandidates(ctx, frame, would);
  const candidates = forced
    ? windowCandidates(ctx, frame, true, would)
    : [
        ...(frame.optionalAtOpen ?? windowCandidates(ctx, frame, false, would)).filter(
          (candidate) =>
            stillImminent(ctx, frame, candidate) &&
            stillOffered(ctx.state, ctx.deps, candidate, answered(frame, candidate).event),
        ),
        ...late,
      ];
  const advanced = {
    ...frame,
    ...(would ? { wouldTier: tierIndex + 1 } : { tierIndex: tierIndex + 1 }),
    pending: candidates,
    ...(atOpen ? { optionalAtOpen: atOpen } : {}),
    ...(late.length > 0 ? { optionalAtOpen: [...(frame.optionalAtOpen ?? []), ...late] } : {}),
    ...(heard ? { heardAtOpen: heard } : {}),
  };
  if (candidates.length === 0) {
    setFrame(ctx, advanced);
    return;
  }
  emit(ctx, {
    type: "windowOpened",
    event: frame.event,
    timing: frame.timing,
    ...(would ? { would: true as const } : {}),
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
  // A "(defense)" ability an earlier-asked player picked holds this attack's defense for them (`windowDefenseBar`).
  const mine = frame.pending.filter(
    (c) =>
      (c.controllerId ?? ctx.state.firstPlayerId) === current &&
      stillImminent(ctx, frame, c) &&
      windowDefenseBar(ctx.state, ctx.deps, frame.queue, c) === null,
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
function windowEventCost(ctx: Ctx, frame: Frame<"window">, candidate: TriggerCandidate): number {
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
  // Played from the top of the deck, less its permission's reduction (`playableTopOfDeck`, docs/phase7-wave8.md §3.49).
  const reduced = Math.max(
    0,
    modified -
      costReductionFor(ctx.state, ctx.deps, candidate.controllerId, candidate.instanceId) -
      deckTopCostReduction(ctx.state, ctx.deps, candidate.controllerId, candidate.instanceId),
  );
  // The ability's own resources, a computed X included (`resourcesEqualTo`), as `planCost` will ask for them.
  const abilityCost = costResourceRequirement(
    ctx.state,
    ctx.deps,
    candidate.instanceId,
    candidate.controllerId,
    ctx.deps.abilities[candidate.abilityId]?.cost,
    answered(frame, candidate).event,
  ).requirement;
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
    // "This card and up to N others" (`InPlayCostPick.includesSelf`): the card itself is not a question, only the
    // others are, and picking none of them pays with the card alone (`absorbCostPick` adds it).
    const own = pick.includesSelf ? 1 : 0;
    const offered = pick.includesSelf ? candidates.filter((id) => id !== candidate.instanceId) : candidates;
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
      options: offered.map((id) => ({
        optionId: id,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "card", instanceId: id },
      })),
      minSelections: 0,
      maxSelections: Math.min(offered.length, (pick.max ?? candidates.length) - own),
      frameId: frame.frameId,
    });
    return true;
  }
  return false;
}

/** `CostChoices` key (and binding slot) of a hand-discard cost's picks (`AbilityCost.discardFromHand`). */
const HAND_DISCARD_SLOT = "discard";

/**
 * Asks the candidate's controller which cards from hand pay its "discard N cards from your hand →" cost
 * (`AbilityCost.discardFromHand`), after its picks of cards in play and before its payment: RRG 1.8 "Initiating
 * Abilities" (p. 24), the cost is determined (step 3) before it is paid (step 5). Asked as a `chooseCostCards` choice
 * with mode `discardFromHand`; selecting fewer than the cost's `min` backs out, as for a pick of cards in play. Asked
 * even when the hand holds exactly `min` candidates, since those cards may also be what the player would pay
 * resources with. Not asked with too few candidates (`planCost` refuses the cost), nor for a cost with no minimum and
 * no `combined` threshold, which pays with no discard as it did before a window asked.
 */
function askHandDiscard(
  ctx: Ctx,
  frame: Frame<"window">,
  candidate: TriggerCandidate,
  rest: readonly TriggerCandidate[],
): boolean {
  const controller = candidate.controllerId;
  const cost = ctx.deps.abilities[candidate.abilityId]?.cost;
  const discard = cost?.discardFromHand;
  if (!controller || !discard || (discard.min <= 0 && !discard.combined)) return false;
  const choices = costChoicesFor(frame, candidate);
  if (choices[HAND_DISCARD_SLOT] !== undefined) return false;
  const candidates = handDiscardCandidates(ctx.state, ctx.deps, candidate.instanceId, controller, cost);
  if (candidates.length < Math.max(discard.min, 1)) return false;
  setFrame(ctx, {
    ...frame,
    queue: rest,
    awaiting: "costPick",
    paying: candidate,
    costPicks: {
      key: candidateKey(candidate),
      choices,
      asking: HAND_DISCARD_SLOT,
      ...costSelectionFor(frame, candidate),
    },
  });
  requestChoice(ctx, {
    playerId: controller,
    prompt: {
      kind: "chooseCostCards",
      instanceId: candidate.instanceId,
      abilityId: candidate.abilityId,
      slot: HAND_DISCARD_SLOT,
      mode: "discardFromHand",
    },
    options: candidates.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id },
    })),
    minSelections: 0,
    maxSelections: Math.min(candidates.length, discard.max ?? candidates.length),
    frameId: frame.frameId,
  });
  return true;
}

/** The payment options left once the cards picked for the candidate's hand-discard cost are kept out of them. */
function withoutHandDiscards(
  frame: Frame<"window">,
  candidate: TriggerCandidate,
  options: readonly ChoiceOption[],
): readonly ChoiceOption[] {
  const picked = new Set((costChoicesFor(frame, candidate)[HAND_DISCARD_SLOT] ?? []).map((id) => `hand:${id}`));
  return picked.size === 0 ? options : options.filter((option) => !picked.has(option.optionId));
}

/**
 * The answer to a `chooseCostCards` choice: record the pick and put the candidate back at the head of the queue, so the
 * next pick (or its payment) is asked. Fewer than the pick's `min` backs out of the candidate.
 */
function absorbCostPick(ctx: Ctx, frame: Frame<"window">, answer: readonly string[], slot: string | null): void {
  const candidate = frame.paying;
  const { costPicks: _dropped, ...cleared } = { ...frame, answer: null, awaiting: null, paying: null };
  const cost = candidate ? ctx.deps.abilities[candidate.abilityId]?.cost : undefined;
  // A pick of cards in play, or the hand-discard cost's (`askHandDiscard`), which needs at least one card.
  const pick =
    inPlayPicksOf(cost).find((entry) => entry.pick.slot === slot)?.pick ??
    (slot === HAND_DISCARD_SLOT && cost?.discardFromHand
      ? { slot: HAND_DISCARD_SLOT, min: Math.max(cost.discardFromHand.min, 1) }
      : undefined);
  const chosen = answer.map((id) => id as InstanceId);
  // "This card and up to N others" (`InPlayCostPick.includesSelf`): only the others were asked for.
  const picked =
    candidate && pick && "includesSelf" in pick && pick.includesSelf ? [candidate.instanceId, ...chosen] : chosen;
  if (!candidate || !pick || picked.length < pick.min) return setFrame(ctx, cleared);
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
    on.event,
  );
  if (isPriceFault(plan)) return;
  const needed = requirementTotal(plan.requirement);
  // An "X" cost ("spend up to 3 resources", Machine Man) totals 0 fixed resources but is still the player's decision
  // (the same guard `requestWindowPayment` has; docs/phase7-wave4.md §3.36).
  // So is a size the player chooses ("spend up to 3 resources →", `ResourcesChoice`; docs/phase7-wave8.md §3.62): the
  // prompt carries its range, and `resolveChoice` refuses a selection below it (above it, the rest is overpaid).
  const chosenSize = resourcesChoiceOf(plan.cost ?? definition.cost);
  if (needed > 0 || definition.cost.resourcesX !== undefined || chosenSize) {
    const payingFor = plan.payingFor ?? candidate.instanceId;
    const options = withoutHandDiscards(frame, candidate, paymentOptions(ctx, controller, null, payingFor));
    setFrame(ctx, { ...frame, awaiting: "pay", paying: candidate });
    requestChoice(ctx, {
      playerId: controller,
      prompt: {
        kind: "payForAbility",
        instanceId: candidate.instanceId,
        abilityId: candidate.abilityId,
        cost: needed,
        ...(chosenSize ? { chosenResources: { min: chosenSize.min, max: chosenSize.max, payingFor } } : {}),
      },
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
    // A hand card spent on the resources cannot also be the card discarded for the cost (RRG 1.8 "Cost", p. 13).
    handCardsIn(payment),
    selection,
    on.event,
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
  // The types the ability reads of this payment (docs/phase7-wave8.md §3.62): a wild whose declaration can change the
  // reading is asked about by the ability's own frame, before it resolves anything.
  const settled = settleAbilityPaidTypes(
    ctx,
    definition,
    payingFor,
    pool,
    { ...plan.vars, ...paidVars },
    plan.requirement,
    plan.cost ?? definition.cost,
  );
  if (isPriceFault(settled)) return;
  const spent = payPayment(ctx, controller, payment, payingFor);
  pushFrames(ctx, [
    abilityFrame(ctx, candidate, on.event, on.eventFrameId, plan.bindings, settled.vars, settled.types?.undeclared),
  ]);
  logAbilityWildTypes(ctx, controller, candidate.instanceId, candidate.abilityId, settled.types);
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
  const cost = windowEventCost(ctx, frame, candidate);
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
  const eventCost = ctx.deps.abilities[candidate.abilityId]?.cost;
  const hasXCost = eventCost?.resourcesX !== undefined || resourcesChoiceOf(eventCost) !== null;
  if (cost === 0 && !hasXCost) {
    const playing = { ...frame, queue: rest, paying: candidate };
    setFrame(ctx, playing);
    playWindowEvent(ctx, playing, []);
    return;
  }
  const options = withoutHandDiscards(frame, candidate, paymentOptions(ctx, controller, candidate.instanceId));
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
  // Still in hand, still on a host that lets it be played "as if it were in your hand", or still the top card of the
  // deck under a `playableTopOfDeck` permission not used since it was offered (`inHandCandidates`).
  const deckTop = deckTopPlayOf(ctx.state, ctx.deps, controller, candidate.instanceId);
  if (
    !deckTop &&
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
    deckTop?.costReduction ?? 0,
    selection,
    answered(frame, candidate).event,
    // The window's payment choice carries no declaration of its wilds: the play's own frame asks for one when a card
    // reads the types that paid and the declaration can matter (docs/phase7-wave8.md §3.62).
    { abilityId: candidate.abilityId },
  );
  if (isPriceFault(priced)) return;
  const spent = commitPlay(ctx, controller, candidate.instanceId, payment, priced, deckTop);
  pushPlayCardFrame(
    ctx,
    candidate.instanceId,
    controller,
    null,
    { triggeredAbilityId: candidate.abilityId, ...answered(frame, candidate) },
    playFrameCost(priced),
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
    // Each may be triggered once per occurrence: a picked one is not offered again.
    pending: frame.pending.filter((candidate) => !picked.includes(candidate)),
    ...(picked.length > 0 ? { pickedThisRound: true as const } : {}),
    askingPlayerIds: rest,
  });
}
