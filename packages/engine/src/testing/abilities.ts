import { abilityId, type AbilityReference } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, EngineDeps } from "../abilities.js";

/** An ability definition plus the `AbilityReference` a stub card carries for it. */
export interface StubAbility {
  readonly ref: AbilityReference;
  readonly definition: AbilityDefinition;
}

/** The registry is authoritative for timing, so the content-side reference is just the id. */
export function stubAbility(id: string, definition: AbilityDefinition): StubAbility {
  return { ref: { id: abilityId(id) }, definition };
}

export function registryOf(...abilities: readonly StubAbility[]): AbilityRegistry {
  const registry: Record<string, AbilityDefinition> = {};
  for (const ability of abilities) registry[ability.ref.id] = ability.definition;
  return registry;
}

export const depsOf = (...abilities: readonly StubAbility[]): EngineDeps => ({
  abilities: registryOf(...abilities),
});
