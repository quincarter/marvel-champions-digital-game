/**
 * "Look at the top 2 cards of the encounter deck. Discard 1 of those cards →" as an ability cost
 * (`AbilityCost.encounterLookDiscard`; Thief Extraordinaire, `gambit` 37001b; docs/phase7-wave6.md §3.54): whether it
 * can be paid, and the step that pays it.
 *
 * The cards are hidden until looked at, so the player cannot name them up front the way a hand discard's picks are
 * named in `costChoices`. The look and the pick are therefore a step `payCost` pushes above the frame it pays for (the
 * indirect-damage cost's pattern, `cost-damage.ts`), resolved before that frame's effects (RRG 1.8 "Initiating
 * Abilities", p. 24, steps 5–6; "Cost Arrow Icon", p. 14).
 */

import { type Ctx, emit, moveCard, requestChoice, setFrame, updateInstance } from "./ctx.js";
import { resetEncounterDeckIfEmpty } from "./effects.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { instanceId as asInstanceId, type InstanceId } from "./ids.js";
import { boostIconsFor } from "./modifiers.js";
import { activeEncounterDeckId, discardZoneFor, encounterDeckOf, mustCardOf } from "./query.js";
import { addFrameSlots, addFrameVars, type Frame } from "./resolve/frames.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import type { AbilityCost } from "./abilities.js";

type LookDiscard = NonNullable<AbilityCost["encounterLookDiscard"]>;

/**
 * How many cards a look at the top `look` cards of the active encounter deck would show right now. An empty deck is
 * reset before anything is looked at (RRG 1.8 "Encounter Deck", p. 17: "If the encounter deck is empty, the encounter
 * discard pile is immediately shuffled"), so its discard pile is the supply; looking never empties a deck (p. 27: the
 * cards "are still considered part of that deck"), so a short deck shows what it has.
 */
export function encounterLookSupply(state: GameState, look: number): number {
  const piles = encounterDeckOf(state, activeEncounterDeckId(state));
  const supply = piles.deck.length > 0 ? piles.deck.length : piles.discard.length;
  return Math.min(Math.max(0, look), supply);
}

/** Whether the cost can be paid in full (RRG 1.8 "Cost", p. 13): the cards looked at must supply every discard. */
export const encounterLookPayable = (state: GameState, cost: LookDiscard): boolean =>
  encounterLookSupply(state, cost.look) >= cost.discard;

/** The step `payCost` pushes for the cost, above `paidFor`. */
export function encounterLookDiscardEffects(
  cost: LookDiscard,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  return [
    {
      kind: "payEncounterLookDiscard",
      look: cost.look,
      discard: cost.discard,
      slot: cost.slot,
      paidFor: paidFor?.frameId ?? null,
    },
  ];
}

/**
 * The `payEncounterLookDiscard` step. First pass: an empty deck is reset, the payer looks at the top cards (logged as
 * `cardsLookedAt`) through a `chooseCards` choice offering exactly them, which is what makes them face-visible to the
 * payer while it is open (`visibility.ts`); exactly `discard` must be picked. Second pass: the picks are discarded one
 * at a time in deck order, top first (RRG 1.8 "Discard", p. 16: discarded "from the top of that deck", "one at a time
 * (without changing the order)"), each faceup into its own discard pile; the move that empties the deck resets it
 * (§3.60). The cards not picked never moved, so they are still on top in their order (RRG 1.8 "Look, Looked-At",
 * p. 27). The picks are bound to `slot` on the paid-for frame, with `<slot>.count` and `<slot>.boostIcons` (read as
 * each card is discarded, before it moves, as `discardEncounterCards` does).
 *
 * Checked payable by `planCost`; should the deck still have fewer cards than `discard` here, the cost is not paid:
 * nothing is discarded and the paid-for frame is marked (`COST_NOT_PAID_VAR`) so its effects do not resolve.
 */
export function executePayEncounterLookDiscard(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "payEncounterLookDiscard" }>,
): void {
  const deckId = activeEncounterDeckId(ctx.state);
  const payer = frame.controllerId;
  if (frame.answer === null) {
    resetEncounterDeckIfEmpty(ctx, deckId);
    const lookedAt = encounterDeckOf(ctx.state, deckId).deck.slice(0, Math.max(0, effect.look));
    if (!payer || lookedAt.length < effect.discard || effect.discard < 1) {
      setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
      emit(ctx, {
        type: "encounterLookCostSettled",
        instanceId: frame.selfInstanceId,
        playerId: payer,
        lookedAt: [],
        discarded: [],
        paid: false,
      });
      addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
      return;
    }
    // The looked-at cards, top first, kept on this frame for the log entry the second pass writes.
    setFrame(ctx, { ...frame, bindings: { ...frame.bindings, [lookedAtSlot(effect.slot)]: lookedAt } });
    emit(ctx, { type: "cardsLookedAt", playerId: payer, instanceIds: lookedAt });
    requestChoice(ctx, {
      playerId: payer,
      prompt: { kind: "chooseCards", slot: effect.slot },
      options: lookedAt.map((id) => ({
        optionId: id,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "card", instanceId: id } as const,
      })),
      minSelections: effect.discard,
      maxSelections: effect.discard,
      frameId: frame.frameId,
    });
    return;
  }
  const lookedAt = frame.bindings[lookedAtSlot(effect.slot)] ?? [];
  const picked = new Set(frame.answer.map((id) => asInstanceId(id)));
  // Deck order, top first, whatever order the picks were given in.
  const discards: InstanceId[] = lookedAt.filter((id) => picked.has(id));
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  emit(ctx, { type: "targetChosen", slot: effect.slot, instanceIds: discards });
  let boostIcons = 0;
  for (const id of discards) {
    updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
    boostIcons += boostIconsFor(ctx.state, ctx.deps, id);
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
  }
  emit(ctx, {
    type: "encounterLookCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: payer,
    lookedAt,
    discarded: discards,
    paid: true,
  });
  addFrameSlots(ctx, effect.paidFor, { [effect.slot]: discards });
  addFrameVars(ctx, effect.paidFor, {
    [`${effect.slot}.count`]: discards.length,
    [`${effect.slot}.boostIcons`]: boostIcons,
  });
}

const lookedAtSlot = (slot: string): string => `${slot}.lookedAt`;
