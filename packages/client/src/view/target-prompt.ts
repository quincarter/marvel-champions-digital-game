/**
 * The question a card's own `chooseTarget` asks in place of "Choose a target" (`EffectSpec chooseTarget.prompt`):
 * Maria Hill's Reassignment (50001a) picks the support a counter moves FROM, then the one it moves TO, and the plain
 * title didn't say which pick was which (issue #911).
 */
import type { AbilityId } from "@mc/content";
import type { EffectSpec, EngineDeps } from "@mc/engine";

/** The `prompt` of the ability's `chooseTarget` for `slot` (its first one when `slot` is absent), or null. */
export function targetPromptOf(
  deps: EngineDeps,
  abilityId: AbilityId | string | null | undefined,
  slot?: string,
): string | null {
  if (!abilityId) return null;
  const effects = deps.abilities[abilityId as AbilityId]?.effects;
  return effects ? findPrompt(effects, slot) : null;
}

function findPrompt(value: unknown, slot: string | undefined): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPrompt(item, slot);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const effect = value as Partial<Extract<EffectSpec, { kind: "chooseTarget" }>>;
  if (effect.kind === "chooseTarget" && (slot === undefined || effect.slot === slot)) {
    // The first pick of its slot answers; one without a prompt says the plain title is meant.
    return typeof effect.prompt === "string" ? effect.prompt : null;
  }
  for (const child of Object.values(value)) {
    if (typeof child !== "object" || child === null) continue;
    const found = findPrompt(child, slot);
    if (found !== null) return found;
  }
  return null;
}
