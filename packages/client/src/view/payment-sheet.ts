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
  handCardResources,
  poolTotal,
  type EngineDeps,
  type GameState,
  type PendingChoice,
} from "@mc/engine";

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
  choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility";

export function paymentSheetView(
  state: GameState,
  choice: PendingChoice,
  selected: readonly string[],
  deps: EngineDeps,
): PaymentSheetView | null {
  const { prompt } = choice;
  if (prompt.kind !== "payForCard" && prompt.kind !== "payForAbility") return null;
  let paid = 0;
  for (const optionId of selected) {
    const option = choice.options.find((candidate) => candidate.optionId === optionId);
    if (!option) continue;
    paid +=
      option.ref.kind === "card"
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

/** The engine's own verdict: a payment that pays changes the table; an under-payment only closes the question. */
function pays(state: GameState, choice: PendingChoice, selected: readonly string[], deps: EngineDeps): boolean {
  const result = applyCommand(
    state,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
    deps,
  );
  if (!result.ok) return false;
  return (
    JSON.stringify(result.state.players) !== JSON.stringify(state.players) ||
    JSON.stringify(result.state.instances) !== JSON.stringify(state.instances)
  );
}
