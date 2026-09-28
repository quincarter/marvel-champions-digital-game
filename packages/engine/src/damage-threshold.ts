import type { AnyCard } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import { printedAbilityRefs } from "./select.js";
import type { EffectSpec } from "./spec.js";

/**
 * The damage at which a card discards itself, read from its own scripted text: "If there is 5 or more damage here,
 * discard Crossbones' Armor" (`trors` 04065), "Then, if there is at least 5 damage here, discard Armored Rhino Suit"
 * (`core` 01098). That is an `if` whose condition is `damagedAtLeast` on `self` and whose `then` discards `self`,
 * anywhere in one of the card's abilities. Null for every card with no such clause. It is display information only
 * (the board shows "2/5 damage" on the card); the ability itself still decides when the card leaves play.
 */
export function selfDiscardDamageThreshold(card: AnyCard, deps: EngineDeps): number | null {
  for (const ref of printedAbilityRefs(card)) {
    const definition = deps.abilities[ref.id];
    const found = definition ? thresholdIn(definition.effects) : null;
    if (found !== null) return found;
  }
  return null;
}

function thresholdIn(effects: readonly EffectSpec[]): number | null {
  for (const effect of effects) {
    if (
      effect.kind === "if" &&
      effect.condition.kind === "damagedAtLeast" &&
      effect.condition.of.kind === "self" &&
      effect.then.some((then) => then.kind === "discardFromPlay" && then.target.kind === "self")
    ) {
      return effect.condition.amount;
    }
    // Nested programs: "instead" (`replaceTriggeringEvent.with`), "then", and either branch of an "if".
    const nested = Object.values(effect).flatMap((field) =>
      Array.isArray(field) ? (field as readonly unknown[]).filter(isEffect) : [],
    );
    const found = nested.length > 0 ? thresholdIn(nested) : null;
    if (found !== null) return found;
  }
  return null;
}

const isEffect = (value: unknown): value is EffectSpec =>
  typeof value === "object" && value !== null && typeof (value as { kind?: unknown }).kind === "string";
