import type { AbilityDefinition } from "../abilities.js";
import type { EffectSpec } from "../spec.js";
import type { TriggerEvent } from "../trigger-events.js";
import { flattenEffects, nestedEffects } from "./target-validity.js";

/**
 * Unpreventable damage (docs/phase7-wave11-hero-packs.md §H3.3; Luke Cage 62001a, Internal Injury 62028). RRG 1.8 has no
 * entry; the source is the MC62 insert: the damage "cannot be reduced or prevented", and a tough status card is not
 * removed. Engine reading, sourced to the insert:
 *
 * - `applyDamage` (`event.ts`) takes it through tough (the card stays) and past every constant reduction, live or
 *   lingering (`damageTakenBreakdown` in `rules.ts`), a `preventAllDamage` rule, an attack's "prevent all damage" flag
 *   and its "prevent N damage" budget. Increases (`increaseDamageTaken`, `doubleDamageTaken`, an `increaseDamage`
 *   interrupt) still apply.
 * - A `preventDamage` / `reduceDamageTo` effect that resolves against it does nothing (`apply-effect.ts`); the rest of
 *   its ability resolves. An optional interrupt that could do nothing else is not offered
 *   (`interruptBarredByUnpreventable`).
 * - Still applying, as "cannot"s are absolute (RRG 1.8 "Cannot", p. 13) and the insert names neither: "cannot take
 *   damage", and the caps ("cannot take more than N damage", "cannot have more than N sustained damage"), whose held-back
 *   damage is neither taken nor prevented (docs/phase7-wave6.md §4.1 Q9). Cancelling the damage event still works too.
 */

/**
 * **Owner question Q103 (open; built at A).** A: only reductions, preventions and tough status cards are barred, so an
 * interrupt that moves the damage to another character ("deal that damage to X instead") or increases it still changes
 * it. B: no effect that answers "would take damage" may change it at all. Flipping this to `true` is the offering half of
 * B: every optional interrupt to unpreventable damage is withheld. The other half is making a forced interrupt's
 * redirect (`replaceTriggeringEvent`) and `increaseDamage` do nothing against it, as `preventDamage` already does
 * (`apply-effect.ts`). Constants are not "would" effects, so constant increases apply under both.
 */
export const UNPREVENTABLE_BARS_EVERY_WOULD_TAKE_INTERRUPT: boolean = false;

/** The interrupt effects that reduce or prevent the interrupted damage, which do nothing against unpreventable damage. */
const REDUCES_OR_PREVENTS: ReadonlySet<EffectSpec["kind"]> = new Set([
  "preventDamage",
  "reduceDamageTo",
  "reduceDamage",
]);

/** Whether this is a damage event that cannot be reduced or prevented. */
export const isUnpreventableDamage = (event: TriggerEvent | null | undefined): boolean =>
  event?.kind === "dealDamage" && event.unpreventable === true;

/**
 * Whether this ability is withheld from a window on `event` because the event is unpreventable damage.
 *
 * **Engine interpretation** (authority step 5: no official source says which abilities are offered): an *optional*
 * interrupt whose every effect (branches included; their `if` / `then` containers aside) reduces or prevents that damage
 * would do nothing, so it is not offered, as a cancel with no target is not (`cancelHasNoTarget`). A forced interrupt
 * still resolves (its prevention does nothing, its other effects happen: a Forcefield Generator still loses its
 * counter), and an optional one with any other effect (Deflection's discard) is still offered. Under Q103 B
 * (`UNPREVENTABLE_BARS_EVERY_WOULD_TAKE_INTERRUPT`), every optional interrupt to it is withheld.
 */
export function interruptBarredByUnpreventable(definition: AbilityDefinition, event: TriggerEvent): boolean {
  const trigger = definition.trigger;
  if (!isUnpreventableDamage(event) || trigger.kind !== "interrupt" || trigger.forced) return false;
  if (UNPREVENTABLE_BARS_EVERY_WOULD_TAKE_INTERRUPT) return true;
  const leaves = flattenEffects(definition.effects).filter((effect) => nestedEffects(effect).length === 0);
  return leaves.length > 0 && leaves.every((effect) => REDUCES_OR_PREVENTS.has(effect.kind));
}
