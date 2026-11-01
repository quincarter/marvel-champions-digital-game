/**
 * The payment sheet's two answers, kept apart (a `payForCard` / `payForAbility` choice raised inside a timing window).
 *
 * The engine reads "pay too little" as "decline" (`engine/src/resolve/window.ts#payWindowAbility`), so a Confirm
 * pressed with too few cards picked used to answer the question with a silent no. This model separates them: Confirm
 * is live only when the engine would actually take the payment, and says what is still missing; declining is its own
 * control with its own name. Whether a selection pays is judged by the engine (a dry run of the same `resolveChoice`
 * command, the way `discard-choice-model.ts` probes), never recounted here; the count in the label is only a
 * best-effort tally for the words.
 */

import {
  applyCommand,
  cardOf,
  handCardResources,
  locateCard,
  paymentOptionsPool,
  poolTotal,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type ResourceRequirement,
} from "@mc/engine";
import { cardName } from "./names.js";

export interface PaymentSheetView {
  /** What the prompt asks the player to pay. */
  readonly cost: number;
  /** Resources the picks add up to (a tally for the words; the engine decides whether it is enough). */
  readonly paid: number;
  /** True when the engine would take this exact selection as a payment. */
  readonly canConfirm: boolean;
  /** "Pay 2", or "Pay 2 more" while short. */
  readonly confirmLabel: string;
  /** The separate way out: not paying means not using it. */
  readonly declineLabel: string;
  /** Set for a chosen-size cost: "Pay 1 to 3. Up to 3 are spent; extra is overpaid." (selecting more than max is fine). */
  readonly note: string | null;
}

/**
 * The line under a chosen-size cost's title (`chosenResources`, wave 8 row 78): the selection is not capped at `max`;
 * `max` are spent and anything beyond is overpaid. Null for a fixed-size payment.
 */
export function chosenResourcesNoteOf(prompt: PendingChoice["prompt"]): string | null {
  if (prompt.kind !== "payForAbility" || !prompt.chosenResources) return null;
  const { min, max } = prompt.chosenResources;
  const spent = min === max ? `${max}` : `${min} to ${max}`;
  return `Pay ${spent}. Up to ${max} are spent; extra is overpaid.`;
}

export const isPaymentSheet = (choice: Pick<PendingChoice, "prompt">): boolean =>
  choice.prompt.kind === "payForCard" ||
  choice.prompt.kind === "payForAbility" ||
  (choice.prompt.kind === "spendResources" && choice.prompt.required === true);

/** The total of a payment requirement (a tally for the words). */
const requirementTotal = (requirement: ResourceRequirement): number =>
  (requirement.generic ?? 0) +
  (requirement.physical ?? 0) +
  (requirement.mental ?? 0) +
  (requirement.energy ?? 0) +
  (requirement.wild ?? 0);

/**
 * The card a required payment is for, read off the effects frame that asked (`_play.card`, `playFromHand.mustPay`):
 * "Alluring Call" and "Trance of Greed" make the player play a card, and this is that card.
 */
export function playedCardOf(state: GameState, choice: PendingChoice): InstanceId | null {
  const frame = choice.frameId === null ? undefined : state.stack?.find((entry) => entry.frameId === choice.frameId);
  const bound = frame && "bindings" in frame ? frame.bindings["_play.card"]?.[0] : undefined;
  return bound ?? null;
}

/**
 * The line a required payment (`spendResources` with `required`, a `mustPay` play) shows under its title: the card
 * has to be played, so the sheet says so in a few words and has no way to skip it. The full text stays in Inspect.
 */
export function requiredPaymentNoteOf(state: GameState, choice: PendingChoice): string | null {
  if (choice.prompt.kind !== "spendResources") return null;
  const card = playedCardOf(state, choice);
  if (choice.prompt.required !== true) return card ? skippablePlayNoteOf(state, choice, card) : null;
  return card ? `You must play ${cardName(state, card)}. Pick what pays.` : "You must play this card. Pick what pays.";
}

/**
 * The line a play's payment shows when it may be skipped (Team-Building Exercise): a payment that falls short plays
 * nothing and the card that asked has already been used, so that is said before the player commits (issue #569).
 */
export function skippablePlayNoteOf(state: GameState, choice: PendingChoice, card: InstanceId): string {
  const frame = choice.frameId === null ? undefined : state.stack?.find((entry) => entry.frameId === choice.frameId);
  const source = frame && "selfInstanceId" in frame ? frame.selfInstanceId : null;
  const used = source !== null && cardOf(state, source) && state.instances[source]?.exhausted === true;
  const name = cardName(state, card);
  return used ? `Pay for ${name}, or ${cardName(state, source)} stays exhausted.` : `Pay for ${name}.`;
}

export function paymentSheetView(
  state: GameState,
  choice: PendingChoice,
  selected: readonly string[],
  deps: EngineDeps,
): PaymentSheetView | null {
  const { prompt } = choice;
  if (prompt.kind === "spendResources" && prompt.required === true) {
    return requiredPaymentView(state, choice, prompt.requirement, selected, deps);
  }
  if (prompt.kind === "spendResources") {
    const card = playedCardOf(state, choice);
    if (!card) return null;
    return {
      ...requiredPaymentView(state, choice, prompt.requirement, selected, deps),
      declineLabel: "Don't play it",
    };
  }
  if (prompt.kind !== "payForCard" && prompt.kind !== "payForAbility") return null;
  let paid = 0;
  for (const optionId of selected) {
    const option = choice.options.find((candidate) => candidate.optionId === optionId);
    if (!option) continue;
    // A hand card spent with its own ability is worth what the engine says: the card and what the ability generates.
    const spent =
      option.ref.kind === "ability" && optionId.startsWith("hand:")
        ? paymentOptionsPool(state, deps, choice.playerId, [optionId], prompt.instanceId)
        : null;
    paid += spent
      ? poolTotal(spent)
      : option.ref.kind === "card"
        ? poolTotal(handCardResources(state, deps, option.ref.instanceId, choice.playerId, prompt.instanceId))
        : 1;
  }
  const canConfirm = selected.length > 0 && pays(state, choice, selected, deps);
  const chosen = prompt.kind === "payForAbility" ? prompt.chosenResources : undefined;
  // A chosen-size cost has `cost` 0 and a floor of `min`; more than `max` is overpaid, never blocked.
  const needed = chosen ? chosen.min : prompt.cost;
  const missing = Math.max(1, needed - paid);
  return {
    note: chosenResourcesNoteOf(prompt),
    cost: prompt.cost,
    paid,
    canConfirm,
    confirmLabel: canConfirm
      ? chosen
        ? paid > chosen.max
          ? `Pay ${chosen.max}, overpay ${paid - chosen.max}`
          : `Pay ${Math.max(paid, 1)}`
        : prompt.cost > 0
          ? `Pay ${prompt.cost}`
          : "Pay"
      : `Pay ${missing} more`,
    declineLabel: prompt.kind === "payForCard" ? "Don't play it" : "Don't use it",
  };
}

/**
 * A payment nobody may skip: Confirm is live only when the engine would take the selection (it refuses a short or
 * empty one), and says what is still missing. There is no decline: `canDeclineChoice` is false for it (`minSelections`
 * is the cheapest full payment) and `declineLabel` is never drawn.
 */
function requiredPaymentView(
  state: GameState,
  choice: PendingChoice,
  requirement: ResourceRequirement,
  selected: readonly string[],
  deps: EngineDeps,
): PaymentSheetView {
  const cost = requirementTotal(requirement);
  const card = playedCardOf(state, choice);
  const pool = paymentOptionsPool(state, deps, choice.playerId, selected, card);
  const paid = pool ? poolTotal(pool) : selected.length;
  const canConfirm = selected.length > 0 && pays(state, choice, selected, deps, card);
  return {
    note: requiredPaymentNoteOf(state, choice),
    cost,
    paid,
    canConfirm,
    confirmLabel: canConfirm ? `Pay ${cost}` : `Pay ${Math.max(1, cost - paid)} more`,
    declineLabel: "",
  };
}

/**
 * The engine's own verdict: a payment that pays changes the table; an under-payment only closes the question. For a
 * play (`played`) the card itself has to move: the effect carries on after a refused payment and may change the table
 * by itself (Squared Off is discarded, The Bifrost shuffles).
 */
function pays(
  state: GameState,
  choice: PendingChoice,
  selected: readonly string[],
  deps: EngineDeps,
  played: InstanceId | null = null,
): boolean {
  const result = applyCommand(
    state,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
    deps,
  );
  if (!result.ok) return false;
  if (played) return JSON.stringify(locateCard(result.state, played)) !== JSON.stringify(locateCard(state, played));
  return (
    JSON.stringify(result.state.players) !== JSON.stringify(state.players) ||
    JSON.stringify(result.state.instances) !== JSON.stringify(state.instances)
  );
}
