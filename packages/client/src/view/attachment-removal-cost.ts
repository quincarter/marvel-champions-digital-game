/**
 * What removing an attachment costs (issue #767): the printed "Hero Action: [cost] → discard this card" ability on it
 * (Solid-Sound Body, Vibranium Armor, Crown of the Enchantress, Haywire), read from its scripted ability's
 * `AbilityCost` and worded by `costPhrase`, the same words an action button uses, so the chip never invents one. Null
 * for an attachment players cannot remove that way.
 */

import { activeAbilityRefs, cardOf, getInstance, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { costPhrase } from "./ability-label.js";

export interface RemovalCost {
  /** "spend 2 physical, exhaust your identity"; null for a cost `costPhrase` has no words for (the chip then says so). */
  readonly phrase: string | null;
  /** The ability has no cost at all. */
  readonly free: boolean;
  /** Usable only in hero form ("Hero Action"). */
  readonly heroOnly: boolean;
}

/** An effect that puts the ability's own card into the discard pile: `discard(self)` or `moveCards(cards(self), "discard")`. */
function discardsItself(effects: readonly unknown[]): boolean {
  return effects.some((effect) => {
    const spec = effect as {
      readonly kind?: string;
      readonly target?: { readonly kind?: string };
      readonly cards?: { readonly kind?: string; readonly ref?: { readonly kind?: string } };
      readonly to?: unknown;
    };
    if (spec.kind === "discardFromPlay") return spec.target?.kind === "self";
    if (spec.kind === "moveCards") return spec.to === "discard" && spec.cards?.ref?.kind === "self";
    return false;
  });
}

export function removalCostOf(state: GameState, deps: EngineDeps, id: InstanceId): RemovalCost | null {
  const instance = getInstance(state, id);
  if (!instance || instance.faceup === false || instance.facedownAs || cardOf(state, id)?.type !== "attachment") {
    return null;
  }
  for (const ref of activeAbilityRefs(state, id)) {
    const definition = deps.abilities[ref.id];
    if (!definition || definition.trigger.kind !== "action" || definition.trigger.forced) continue;
    if (!discardsItself(definition.effects)) continue;
    const cost = definition.cost;
    const free = cost === undefined || Object.values(cost).every((part) => part === undefined);
    return { phrase: costPhrase(cost), free, heroOnly: definition.trigger.form === "hero" };
  }
  return null;
}

/** "remove: spend 2 physical, exhaust your identity", "remove: free", or "remove: see card" when it has no words. */
export function removalCostText(cost: RemovalCost): string {
  return `remove: ${cost.free ? "free" : (cost.phrase ?? "see card")}`;
}
