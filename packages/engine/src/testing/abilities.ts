import { abilityId, type AbilityReference, type AbilityTrigger } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, EngineDeps } from "../abilities.js";

/** An ability definition plus the `AbilityReference` a stub card carries for it. */
export interface StubAbility {
  readonly ref: AbilityReference;
  readonly definition: AbilityDefinition;
}

const contentTriggerOf = (definition: AbilityDefinition): AbilityTrigger => {
  switch (definition.trigger.kind) {
    case "interrupt":
      return definition.trigger.forced ? "forced_interrupt" : "interrupt";
    case "response":
      return definition.trigger.forced ? "forced_response" : "response";
    case "whenRevealed":
      return "when_revealed";
    case "whenDefeated":
      return "when_revealed";
    case "boost":
      return "boost_effect";
    case "constant":
      return "constant";
    case "setup":
      return "setup";
    case "resource":
      return "action";
    case "action":
      return "action";
  }
};

export function stubAbility(id: string, definition: AbilityDefinition): StubAbility {
  return { ref: { id: abilityId(id), trigger: contentTriggerOf(definition) }, definition };
}

export function registryOf(...abilities: readonly StubAbility[]): AbilityRegistry {
  const registry: Record<string, AbilityDefinition> = {};
  for (const ability of abilities) registry[ability.ref.id] = ability.definition;
  return registry;
}

export const depsOf = (...abilities: readonly StubAbility[]): EngineDeps => ({
  abilities: registryOf(...abilities),
});
