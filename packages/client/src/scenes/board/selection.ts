/**
 * What the player has picked so far on the Board, and the plain rules for
 * reading it. No Phaser imports: this is the part of the table's interaction
 * state that can be reasoned about without a canvas.
 */

import { POOL_DEPS } from "../../content/pool.js";
import type { Command, InstanceId, LegalAction, PlayerId } from "@mc/engine";
import { ink } from "../../tokens.js";
import type { CostChoicePrompt } from "../../view/cost-choice-model.js";
import type { DiscardChoiceState } from "../../view/discard-choice-model.js";
import type { PowerKind, PowerSource } from "../../view/attacker-choice.js";
import type { FormSource } from "../../view/change-form-choice.js";
import type { FocusTarget } from "../../view/focus.js";
import type { BasicAction } from "../../view/highlights.js";
import type { PaymentState } from "../../view/payment-model.js";

/** What the player has picked so far, when an action needs a target or a payment. */
export type Selection =
  | { readonly kind: "idle" }
  /** An action-bar button or a hand card is chosen; now pick what it aims at. */
  | { readonly kind: "targeting"; readonly action: LegalAction; readonly prompt: string }
  /**
   * A card is chosen and aimed; now pick what pays for it. The design makes
   * this a mode over the hand rather than a dialog (`Board - Phone`: a red
   * "PAYING 1 / 3" bar above a hand you tap), so it lives on the Board.
   */
  | { readonly kind: "paying"; readonly payment: PaymentState }
  /**
   * A card or ability whose cost is "discard N cards from your hand" (Shield
   * Toss, `03006`) is chosen; now pick which — and for a cost like Shield
   * Toss's with no printed cap, how many. Modeled the same way as `paying`:
   * a mode over the hand, never a dialog (`view/discard-choice-model.ts`).
   */
  | { readonly kind: "choosingDiscard"; readonly choice: DiscardChoiceState }
  /**
   * A "play under any player's control" card is chosen; now pick whose control
   * it enters play under. The engine lists every seat it may legally go to
   * (`LegalAction.controllers`) — a seat already at "max 1 per player" is not
   * one of them.
   */
  | { readonly kind: "choosingController"; readonly action: LegalAction; readonly controllers: readonly PlayerId[] }
  /**
   * A card that costs nothing was tapped; now say whether to play it. Every other play already passes through a
   * mode the player can back out of — payment, a discard cost, a controller — and a free card had none, so a
   * stray tap on Spiritual Meditation played it, with no way back. Reported from play.
   */
  | { readonly kind: "confirmingPlay"; readonly action: LegalAction; readonly controllerId: PlayerId | null }
  /**
   * Attack (or Thwart) was pressed while more than one character could make it — the hero and an ally, say — so
   * which one goes first is the player's call, not whichever `legalActions` listed first. Each attack is its own
   * action, so the order the player picks them in is the order their effects happen in.
   */
  | { readonly kind: "choosingSource"; readonly power: PowerKind; readonly sources: readonly PowerSource[] }
  /**
   * Change Form was pressed while more than one destination form is legal — Spectrum's energy/density/mass forms,
   * Ant-Man/Wasp's Giant form (`view/change-form-choice.ts`) — so which form to become is the player's call, not
   * whichever `legalActions` listed first.
   */
  | { readonly kind: "choosingForm"; readonly sources: readonly FormSource[] }
  /**
   * An either/or cost branch, or how many counters an "up to N" cost removes, needs choosing before payment can
   * even be priced — a branch changes what the cost *is* (docs/phase7-wave3.md §3.32, §3.36), so this happens
   * before, not during, the payment mode (`view/cost-choice-model.ts`).
   */
  | {
      readonly kind: "choosingCostSelection";
      readonly action: LegalAction;
      readonly target: InstanceId | null;
      readonly controllerId: PlayerId | null;
      readonly prompt: CostChoicePrompt;
    };

export type TargetState = "rest" | "selected" | "unavailable";

/** How a card on the table reads against whatever decision is open. */
export function targetState(selection: Selection, id: InstanceId): TargetState {
  if (selection.kind === "targeting") {
    return selection.action.targets.includes(id) ? "selected" : "unavailable";
  }
  if (selection.kind === "paying") {
    const sources = selection.payment.query.sources;
    if (selection.payment.picked.some((optionId) => sources.find((s) => s.optionId === optionId)?.instanceId === id)) {
      return "selected";
    }
    return sources.some((source) => source.instanceId === id) ? "rest" : "unavailable";
  }
  if (selection.kind === "choosingDiscard") {
    if (selection.choice.picked.includes(id)) return "selected";
    return selection.choice.candidates.includes(id) ? "rest" : "unavailable";
  }
  if (selection.kind === "confirmingPlay") {
    // The card being asked about wears the ring; everything else steps back, as in any other open decision.
    const { action } = selection.action;
    return action.kind === "playCard" && action.instanceId === id ? "selected" : "unavailable";
  }
  if (selection.kind === "choosingSource") {
    return selection.sources.some((source) => source.instanceId === id) ? "selected" : "unavailable";
  }
  return "rest";
}

/**
 * "Out of scope" opacity while a decision is open (dim, don't hide). During
 * targeting that means "not a legal target"; during payment it means "not
 * something you can spend" — a resource ability in play is, and the villain
 * is not.
 */
export function dimAlpha(selection: Selection, id: InstanceId): number {
  return targetState(selection, id) === "unavailable" ? ink.illegal : 1;
}

export const BASIC_TO_KIND: Record<BasicAction, string> = {
  attack: "basicAttack",
  thwart: "basicThwart",
  recover: "basicRecover",
  changeForm: "changeForm",
  endTurn: "endTurn",
};

export const basicKindOf = (entry: LegalAction): BasicAction | null => {
  for (const [action, kind] of Object.entries(BASIC_TO_KIND)) {
    if (entry.action.kind === kind) return action as BasicAction;
  }
  return null;
};

/** One string per focusable thing, so a rect can be looked up by what it is. */
export const focusKey = (target: FocusTarget): string =>
  target.kind === "card" ? `card:${target.instanceId}` : target.kind === "basic" ? `basic:${target.action}` : "cancel";

/**
 * Re-aims the engine's example command at the target the player picked. Only
 * the target field changes: the payment and cost picks the engine found stay
 * exactly as it produced them.
 */
export function retarget(command: Command, target: InstanceId): Command {
  switch (command.type) {
    case "basicAttack":
      return { ...command, targetInstanceId: target };
    case "basicThwart":
      return { ...command, schemeInstanceId: target };
    case "playCard":
      return { ...command, attachToInstanceId: target };
    case "useAbility": {
      // A `useAbility` command carries no target field of its own — every
      // target `legalActions` lists for one is a cost-choice pick (RRG "pay
      // the printed cost of a card in a discard pile", `AbilityCost.payPrintedCostOf`),
      // named by the slot the ability's own cost declares. No Core ability
      // reaches this today (`legal.targets` is always empty for the three
      // Core action abilities that exist), so this reads the registry rather
      // than guessing a shape for content that doesn't exist yet.
      const slot = POOL_DEPS.abilities[command.abilityId]?.cost?.payPrintedCostOf?.slot;
      return slot ? { ...command, costChoices: { ...command.costChoices, [slot]: [target] } } : command;
    }
    default:
      return command;
  }
}
