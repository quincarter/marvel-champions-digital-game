/**
 * "Discard the top card of the encounter deck →" and "Choose a number from 1 to 5. Discard that many cards from the top
 * of the encounter deck →" as an ability cost (`AbilityCost.discardFromEncounterDeck`; docs/phase7-wave9.md §3.43 (a)):
 * the one loop that discards from the top of the encounter deck (shared with `EffectSpec discardEncounterCards`), the
 * range the payer picks from, and the steps that pay the cost.
 *
 * RRG 1.8 "Encounter Deck" (p. 17): "If a card ability discards a specified number of cards from the encounter deck …
 * discard cards from the encounter deck until the discard condition is met or the encounter deck is empty. If the
 * encounter deck is emptied this way, that card ability is considered to be fulfilled. Do not continue the discard
 * effect with the newly shuffled encounter deck." So a deck holding fewer cards than the number owed still pays the
 * cost: what it had is discarded, the deck is reset with its acceleration token, and the text after the arrow reads the
 * cards that were discarded ("for each card discarded this way"). That is the rule's own answer to "Cost" (p. 13),
 * where a cost is paid in full or not at all, and it is why the number a player may choose is not cut to the deck's
 * size, unlike a player deck's (`deck-discard-choice-cost.ts`; RRG 1.8 "Player Deck", p. 33). The cost cannot be paid
 * only when there is no card to discard at all.
 *
 * The cards are hidden (or one is showing, `RuleSpec topOfDeckFaceup { deck: "encounter" }`, §3.42), so nothing is
 * named up front beyond the number: the choice and the discard are a step `payCost` pushes above the frame it pays
 * for, resolved before that frame's effects (RRG 1.8 "Initiating Abilities", p. 24, steps 5–6; "Cost Arrow Icon",
 * p. 14).
 */

import type { EncounterDeckDiscardCost } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { type Ctx, emit, moveCard, setFrame, updateInstance } from "./ctx.js";
import { drawEncounterCard, type EncounterDeckDiscarder, recordEncounterDeckDiscard } from "./effects.js";
import type { EncounterDeckId, InstanceId } from "./ids.js";
import { boostIconsFor } from "./modifiers.js";
import { activeEncounterDeckId, discardZoneFor, encounterDeckOf, hasStarIcon, showingResources } from "./query.js";
import { addPools, EMPTY_POOL, type ResourcePool } from "./resources.js";
import { addFrameSlots, addFrameVars, type Frame } from "./resolve/frames.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";

/** The plan vars holding the range the cost's number is picked from (`encounterDiscardCostRange`). */
export const ENCOUNTER_DISCARD_MIN_VAR = "cost.discardFromEncounterDeck.min";
export const ENCOUNTER_DISCARD_MAX_VAR = "cost.discardFromEncounterDeck.max";

/** What one discard from the top of the encounter deck took, read as each card was discarded, before it moved. */
export interface EncounterTopDiscard {
  /** The cards discarded, in the order they were (top first). */
  readonly discarded: readonly InstanceId[];
  /** Their boost icons (printed plus modifiers, `boostIconsFor`). */
  readonly boostIcons: number;
  /** How many of them print a star in the boost area: a separate count (RRG 1.8 "Boost, Boost Icon", p. 11). */
  readonly starIcons: number;
  /** Their printed resource icons. */
  readonly resources: ResourcePool;
  /** This discard took the deck's last card, so the deck was reset at that move and the discarding stopped. */
  readonly deckEmptied: boolean;
}

/**
 * Discards up to `count` cards from the top of encounter deck `deckId`, one at a time, each faceup into its own
 * discard pile (its `home`). The one loop for a discard from the top of the encounter deck, whether an effect's
 * (`EffectSpec discardEncounterCards`) or a cost's (`AbilityCost.discardFromEncounterDeck`).
 *
 * RRG 1.8 "Encounter Deck" (p. 17): the discarding stops when the deck is emptied *by this discard*, "do not continue
 * the discard effect with the newly shuffled encounter deck". The deck resets at the move that empties it
 * (`resetEncounterDeckIfEmpty`, docs/phase7-wave6.md §3.60), with that card in the new deck, so the last card is known
 * before it moves. A deck that was already empty is reset first (`drawEncounterCard`) and discarded from. While the
 * top card is kept faceup (§3.42) each card that comes to the top is logged as it does (`announceDeckTops`).
 *
 * `by`: the card whose effect or cost this is, and the set it keeps of these cards, for the announcement of each
 * discard (`recordEncounterDeckDiscard`, §3.43 (b)); recorded only in a game with an ability that hears one.
 */
export function discardTopOfEncounterDeck(
  ctx: Ctx,
  count: number,
  by: EncounterDeckDiscarder,
  deckId: EncounterDeckId = activeEncounterDeckId(ctx.state),
): EncounterTopDiscard {
  const discarded: InstanceId[] = [];
  let boostIcons = 0;
  let starIcons = 0;
  let resources = EMPTY_POOL;
  let deckEmptied = false;
  for (let i = 0; i < count; i++) {
    const id = drawEncounterCard(ctx, deckId);
    if (!id) break;
    const last = encounterDeckOf(ctx.state, deckId).deck.length === 1;
    updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
    boostIcons += boostIconsFor(ctx.state, ctx.deps, id);
    if (hasStarIcon(ctx.state, id)) starIcons += 1;
    resources = addPools(resources, showingResources(ctx.state, id));
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
    recordEncounterDeckDiscard(ctx, deckId, id, by);
    discarded.push(id);
    if (last) {
      deckEmptied = true;
      break;
    }
  }
  return { discarded, boostIcons, starIcons, resources, deckEmptied };
}

/** The vars a set of cards discarded from the top of the encounter deck binds under `slot`. */
export const encounterTopDiscardVars = (slot: string, taken: EncounterTopDiscard): Record<string, number> => ({
  [`${slot}.count`]: taken.discarded.length,
  [`${slot}.boostIcons`]: taken.boostIcons,
  [`${slot}.starIcons`]: taken.starIcons,
  [`${slot}.physical`]: taken.resources.physical,
  [`${slot}.mental`]: taken.resources.mental,
  [`${slot}.energy`]: taken.resources.energy,
  [`${slot}.wild`]: taken.resources.wild,
});

/**
 * How many cards a discard from the top of the active encounter deck could take right now: the deck, or, for a state
 * built with an empty deck beside a discard pile (a save, a test's surgery), the deck the rules would already have
 * reshuffled from it.
 */
export function encounterDiscardSupply(state: GameState): number {
  const piles = encounterDeckOf(state, activeEncounterDeckId(state));
  return piles.deck.length > 0 ? piles.deck.length : piles.discard.length;
}

/**
 * The numbers the cost offers its payer right now, or null when it cannot be paid. A fixed `amount` is a range of one
 * number; a chosen one runs from the card's `min` (never below 1; RRG 1.8 "Cost", p. 14) to its `max`, whatever the
 * deck holds (see the file comment). Null only when the range is empty or there is no card to discard.
 */
export function encounterDiscardCostRange(
  state: GameState,
  cost: EncounterDeckDiscardCost,
): { readonly min: number; readonly max: number } | null {
  const min = Math.max(1, typeof cost.amount === "number" ? cost.amount : cost.amount.choose.min);
  const max = typeof cost.amount === "number" ? cost.amount : cost.amount.choose.max;
  return max < min || encounterDiscardSupply(state) < 1 ? null : { min, max };
}

/**
 * The steps `payCost` pushes for the cost, above `paidFor`: the payer's `chooseNumber` choice from the planned range
 * (a range of one number, a fixed amount or one the command named, is not asked), then the discard.
 */
export function encounterDiscardCostEffects(
  min: number,
  max: number,
  slot: string,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  const chosen = "costEncounterDiscardChoice";
  return [
    {
      kind: "chooseNumber",
      player: { kind: "controller" },
      min: { kind: "const", value: min },
      max: { kind: "const", value: max },
      bind: chosen,
    },
    { kind: "payEncounterDeckDiscard", chosen, slot, paidFor: paidFor?.frameId ?? null },
  ];
}

/**
 * The `payEncounterDeckDiscard` step: the chosen number of cards go from the top of the encounter deck to their
 * discard piles (`discardTopOfEncounterDeck`), and the frame being paid for gets the cards as `slot`, with
 * `<slot>.count`, `<slot>.boostIcons`, `<slot>.starIcons` and the resource totals an effect's discard binds, and the
 * number chosen as `<slot>.chosen`.
 *
 * Paid when every card owed was discarded, or the deck was emptied by the discard (RRG 1.8 "Encounter Deck", p. 17:
 * "that card ability is considered to be fulfilled"). With no card to discard, or no number chosen, the cost was not
 * paid: the paid-for frame is marked (`COST_NOT_PAID_VAR`) and its effects do not resolve.
 */
export function executePayEncounterDeckDiscard(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "payEncounterDeckDiscard" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const chosen = frame.vars[`${effect.chosen}.amount`] ?? 0;
  // The paid-for frame's `slot` is the set of the cards "discarded this way": a card a response to its discard takes
  // away is dropped from it before the ability's effects resolve (`settleDeckDiscards`, docs/phase7-wave7.md §4.1 Q32).
  const taken = discardTopOfEncounterDeck(ctx, Math.max(0, chosen), {
    sourceInstanceId: frame.selfInstanceId,
    how: "cost",
    ...(effect.paidFor ? { boundOn: { frameId: effect.paidFor, slot: effect.slot } } : {}),
  });
  addFrameSlots(ctx, effect.paidFor, { [effect.slot]: taken.discarded });
  addFrameVars(ctx, effect.paidFor, {
    ...encounterTopDiscardVars(effect.slot, taken),
    [`${effect.slot}.chosen`]: chosen,
  });
  const paid = chosen > 0 && taken.discarded.length > 0 && (taken.discarded.length === chosen || taken.deckEmptied);
  emit(ctx, {
    type: "encounterDiscardCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    chosen,
    discarded: taken.discarded,
    deckEmptied: taken.deckEmptied,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
