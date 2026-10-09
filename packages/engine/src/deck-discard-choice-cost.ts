/**
 * "Discard up to 3 cards from the top of your deck → …, where X is the number of cards discarded this way" as an
 * ability cost (`AbilityCost.discardFromDeck` with `choose`; docs/phase7-wave8.md §3.55): the range the payer may pick
 * from, and the steps that pay it.
 *
 * RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum of
 * one such game element", and a cost is paid in full or not at all (p. 13). "Player Deck" (p. 33): "If the player's
 * deck empties while the player was discarding cards from their deck, no further cards are discarded from the newly
 * shuffled deck", so the deck in hand bounds the pick. The choice is made as the cost is paid, as the chosen "take any
 * amount of damage →" cost's is (`cost-damage.ts`).
 */

import type { AbilityCost, DeckDiscardChoice } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { type Ctx, emit, setFrame } from "./ctx.js";
import { discardFromDeckAsCost } from "./effects.js";
import type { PlayerState } from "./state.js";
import { addFrameSlots, addFrameVars, type Frame } from "./resolve/frames.js";
import type { EffectSpec } from "./spec.js";

/** The plan vars holding the range a chosen deck discard is picked from (`deckDiscardChoiceRange`). */
export const DECK_DISCARD_MIN_VAR = "cost.discardFromDeck.min";
export const DECK_DISCARD_MAX_VAR = "cost.discardFromDeck.max";
/** The var the number of cards the cost discarded is read from by the text after the arrow. */
export const DECK_DISCARD_VAR = "cost.discardFromDeck";

export const isDeckDiscardChoice = (
  discardFromDeck: AbilityCost["discardFromDeck"],
): discardFromDeck is DeckDiscardChoice =>
  typeof discardFromDeck === "object" && discardFromDeck !== null && "choose" in discardFromDeck;

/**
 * The cards a deck discard cost can take from `player` right now: the deck, or, for a state built with an empty deck
 * beside a discard pile (a save, a test's surgery), the deck the rules would already have reshuffled from it.
 */
export const deckDiscardSupply = (player: PlayerState): number =>
  player.deck.length > 0 ? player.deck.length : player.discard.length;

/**
 * The numbers a chosen deck discard offers `player`, or null when it cannot be paid: from the card's `min` (never
 * below 1; RRG 1.8 "Cost", p. 14) to the smaller of its `max` and the cards the deck can supply.
 */
export function deckDiscardChoiceRange(
  player: PlayerState,
  cost: DeckDiscardChoice,
): { readonly min: number; readonly max: number } | null {
  const min = Math.max(1, cost.choose.min);
  const max = Math.min(cost.choose.max, deckDiscardSupply(player));
  return max < min ? null : { min, max };
}

/**
 * The steps `payCost` pushes for the cost, above `paidFor`: the payer's `chooseNumber` choice from the planned range
 * (a range of one number is not asked), then the discard of that many cards.
 */
export function chosenDeckDiscardEffects(
  min: number,
  max: number,
  slot: string | undefined,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  const chosen = "costDeckDiscardChoice";
  return [
    {
      kind: "chooseNumber",
      player: { kind: "controller" },
      min: { kind: "const", value: min },
      max: { kind: "const", value: max },
      bind: chosen,
    },
    {
      kind: "payDeckDiscardChoice",
      chosen,
      ...(slot === undefined ? {} : { slot }),
      paidFor: paidFor?.frameId ?? null,
    },
  ];
}

/**
 * The `payDeckDiscardChoice` step: the chosen number of cards go from the top of the payer's deck to their discard
 * pile as any deck discard cost's do (`discardFromDeckAsCost`: a deck this empties resets at once), and the frame
 * being paid for gets their count as var `cost.discardFromDeck` and, with a `slot`, the cards themselves. Fewer cards
 * discarded than chosen means the cost was not paid, and that frame's effects do not resolve.
 */
export function executePayDeckDiscardChoice(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "payDeckDiscardChoice" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const chosen = frame.vars[`${effect.chosen}.amount`] ?? 0;
  const playerId = frame.controllerId;
  const boundOn =
    effect.slot !== undefined && effect.paidFor ? { frameId: effect.paidFor, slot: effect.slot } : undefined;
  const discarded =
    playerId && chosen > 0
      ? discardFromDeckAsCost(ctx, playerId, chosen, {
          sourceInstanceId: frame.selfInstanceId,
          ...(boundOn ? { boundOn } : {}),
        })
      : [];
  if (effect.slot !== undefined) addFrameSlots(ctx, effect.paidFor, { [effect.slot]: discarded });
  addFrameVars(ctx, effect.paidFor, { [DECK_DISCARD_VAR]: discarded.length });
  const paid = chosen > 0 && discarded.length === chosen;
  emit(ctx, {
    type: "deckDiscardCostSettled",
    instanceId: frame.selfInstanceId,
    playerId,
    chosen,
    discarded,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
