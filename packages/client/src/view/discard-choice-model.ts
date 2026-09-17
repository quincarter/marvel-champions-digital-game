/**
 * Choosing which — and how many — hand cards pay a "discard N cards from
 * your hand" cost, as the player's own decision.
 *
 * `legalActions`'s `example` command always carries a *legal* answer to a
 * `discardFromHand` cost, but only the smallest one: `min` cards, chosen by
 * the engine's own tie-break (`legal.ts`'s `discardPicks`, cheapest first).
 * For a fixed "discard 1" that is merely a placeholder pick (RRG "Cost": the
 * player chooses which card, not the engine) — and for a cost like Shield
 * Toss's "discard X cards … deal 4 damage to X enemies" (`03006`, min 0, no
 * cap) the count itself is the whole decision, so defaulting to the minimum
 * silently answers "zero" and the ability does nothing. This is PLAN.md
 * Phase 7's "known missing pickers for in-play costs, where `legal.ts`
 * auto-fills one default candidate."
 *
 * Modeled on `payment-model.ts`: a mode over the hand, tracked as which
 * candidates are picked, with the engine's own `applyCommand` as the only
 * judge of whether a selection is legal — never a rule restated here. The
 * one thing this module decides itself is *which hand cards are worth
 * offering at all* (every hand card but the ability's own source, the same
 * predicate `legal.ts`'s `discardPicks` already uses), which is data the
 * client already has in full for its own hand and needs no engine query for.
 */

import {
  activeAbilityRefs,
  applyCommand,
  getPlayer,
  type AbilityCost,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from "@mc/engine";

/** A `discardFromHand` cost's shape, read straight off the ability registry. */
export interface DiscardCostShape {
  readonly min: number;
  /** Null for "no printed cap" (Shield Toss) — bounded only by hand size. */
  readonly max: number | null;
}

/**
 * The cost an action would pay, for either shape `legalActions` can hand
 * back: a `useAbility` action names its own `abilityId` directly, but an
 * event card's printed action (Shield Toss, `03006`) resolves when the card
 * is *played* — `ActionRef` is then `playCard`, and the ability that carries
 * the cost is whichever of the card's printed abilities is action-triggered
 * (the engine's own `eventActionAbility`, `packages/engine/src/actions.ts`,
 * is internal, so this mirrors it with the same public `activeAbilityRefs`
 * every other card-in-hand/in-play lookup already uses).
 */
function actionAbilityCost(state: GameState, deps: EngineDeps, action: LegalAction["action"]): AbilityCost | undefined {
  if (action.kind === "useAbility") return deps.abilities[action.abilityId]?.cost;
  if (action.kind !== "playCard") return undefined;
  for (const ref of activeAbilityRefs(state, action.instanceId)) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") return definition.cost;
  }
  return undefined;
}

/** The `discardFromHand` cost this action would pay, or null when it has none. */
export function discardCostOf(state: GameState, deps: EngineDeps, action: LegalAction["action"]): DiscardCostShape | null {
  const cost = actionAbilityCost(state, deps, action)?.discardFromHand;
  if (!cost) return null;
  return { min: cost.min, max: cost.max ?? null };
}

/** Every hand card that could pay this cost: the whole hand but the ability's own source card. */
export function discardCandidates(state: GameState, playerId: PlayerId, sourceId: InstanceId): readonly InstanceId[] {
  return (getPlayer(state, playerId)?.hand ?? []).filter((id) => id !== sourceId);
}

export interface DiscardChoiceState {
  readonly action: LegalAction;
  /** The card whose cost this is (Shield Toss itself) — never a candidate, ringed like a payment's subject when it's in hand. */
  readonly source: InstanceId;
  readonly min: number;
  /** The effective ceiling: the printed cap, or every candidate when there is none. */
  readonly max: number;
  readonly candidates: readonly InstanceId[];
  readonly picked: readonly InstanceId[];
}

/**
 * Opens the picker for a `playCard` or `useAbility` action whose cost has a
 * real discard choice in it — more than one legal selection exists. Null
 * when there isn't one: no `discardFromHand` cost at all, or so few hand
 * cards that every candidate must be discarded regardless (a hand of exactly
 * `min` cards), which is the one case where the engine's own default is the
 * only answer anyway, and `legalActions` already found it.
 */
export function beginDiscardChoice(
  state: GameState,
  playerId: PlayerId,
  action: LegalAction,
  deps: EngineDeps,
): DiscardChoiceState | null {
  if (action.action.kind !== "playCard" && action.action.kind !== "useAbility") return null;
  const cost = discardCostOf(state, deps, action.action);
  if (!cost) return null;
  const candidates = discardCandidates(state, playerId, action.action.instanceId);
  if (candidates.length <= cost.min) return null;
  const max = cost.max ?? candidates.length;
  return { action, source: action.action.instanceId, min: cost.min, max, candidates, picked: [] };
}

/** Toggles one candidate. Adding past `max`, or a card not offered, is a no-op — the same "dim, don't hide" rule as everywhere else. */
export function toggleDiscardChoice(choice: DiscardChoiceState, id: InstanceId): DiscardChoiceState {
  if (!choice.candidates.includes(id)) return choice;
  if (choice.picked.includes(id)) return { ...choice, picked: choice.picked.filter((picked) => picked !== id) };
  if (choice.picked.length >= choice.max) return choice;
  return { ...choice, picked: [...choice.picked, id] };
}

export interface DiscardChoiceView {
  readonly source: InstanceId;
  readonly min: number;
  readonly max: number;
  readonly candidates: readonly InstanceId[];
  readonly picked: ReadonlySet<InstanceId>;
  /**
   * The command to send, when the engine accepts this exact selection —
   * `action.example` with only the `discard` cost slot replaced, everything
   * else (the ability's other cost picks, its payment) exactly as
   * `legalActions` already found it. Null while it does not, with the
   * engine's reason in `blockedBy` (below `min`, or above `max`).
   */
  readonly command: Command | null;
  readonly blockedBy: string | null;
}

/**
 * Builds the candidate command and asks the engine to judge it — the same
 * "the engine's `applyCommand` is the only judge of whether a selection
 * works" pattern `tryPayment` already uses, run here because a discard-cost
 * pick is not a *payment* (`PaymentQuery`/`paymentFor` never model it): it is
 * a `costChoices` slot, plain data the client already has full access to.
 * `applyCommand` is pure (`packages/engine/src/engine.ts`: "same state +
 * command + deps always produce the same next state"), so probing it here
 * commits nothing until the player confirms and the result is dispatched for
 * real, the same two-step `payment-model.ts` already established.
 */
export function discardChoiceView(state: GameState, choice: DiscardChoiceState, deps: EngineDeps): DiscardChoiceView {
  const picked = new Set(choice.picked);
  const base = choice.action.example;
  if (base.type !== "playCard" && base.type !== "useAbility") {
    return { source: choice.source, min: choice.min, max: choice.max, candidates: choice.candidates, picked, command: null, blockedBy: "not a discard cost" };
  }
  const command: Command = { ...base, costChoices: { ...base.costChoices, discard: choice.picked } };
  const result = applyCommand(state, command, deps);
  return {
    source: choice.source,
    min: choice.min,
    max: choice.max,
    candidates: choice.candidates,
    picked,
    command: result.ok ? command : null,
    blockedBy: result.ok ? null : result.error.message,
  };
}
