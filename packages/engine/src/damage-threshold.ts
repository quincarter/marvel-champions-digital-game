import type { EngineDeps } from "./abilities.js";
import { activeAbilityRefs, resolveValue, type EffectContext } from "./select.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { InstanceId } from "./ids.js";
import type { GameState } from "./state.js";

/**
 * The damage at which a card's own text does something to it, read from its scripted abilities on the face in play:
 * "If there is 5 or more damage here, discard Crossbones' Armor" (`trors` 04065), "Then, if there is at least 5
 * damage here, discard Armored Rhino Suit" (`core` 01098), "if there is at least 9[per_hero] damage here, remove all
 * of it. Then flip Avengers Tower over" (`mts` 21100a). That is any `if` whose condition asks whether the card itself
 * holds at least N damage (`damagedAtLeast` on `self`, or `compare` of `damage` on `self` against a value, resolved
 * for this game so a [per_hero] threshold reads as the real number). Null when the card has no such clause.
 *
 * Display information only: the board shows "2/5" beside the card so the table can see how close it is. The ability
 * itself still decides what happens and when.
 */
export function selfDamageThreshold(state: GameState, id: InstanceId, deps: EngineDeps): number | null {
  const context: EffectContext = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
  const thresholdOf = (condition: Predicate): number | null => {
    if (condition.kind === "damagedAtLeast" && condition.of.kind === "self") return condition.amount;
    if (
      condition.kind === "compare" &&
      condition.op === "atLeast" &&
      condition.left.kind === "damage" &&
      condition.left.of.kind === "self"
    ) {
      return resolveValue(state, condition.right, context, deps);
    }
    return null;
  };
  const search = (effects: readonly EffectSpec[]): number | null => {
    for (const effect of effects) {
      if (effect.kind === "if") {
        const found = thresholdOf(effect.condition);
        if (found !== null) return found;
      }
      // Nested programs: "instead" (`replaceTriggeringEvent.with`), "then", either branch of an "if", and so on.
      const nested = Object.values(effect).flatMap((field) =>
        Array.isArray(field) ? (field as readonly unknown[]).filter(isEffect) : [],
      );
      const found = nested.length > 0 ? search(nested) : null;
      if (found !== null) return found;
    }
    return null;
  };
  for (const ref of activeAbilityRefs(state, id, deps)) {
    const definition = deps.abilities[ref.id];
    const found = definition ? search(definition.effects) : null;
    if (found !== null) return found;
  }
  return null;
}

const isEffect = (value: unknown): value is EffectSpec =>
  typeof value === "object" && value !== null && typeof (value as { kind?: unknown }).kind === "string";
