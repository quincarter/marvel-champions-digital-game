import type {
  AbilityDefinition,
  EffectSpec,
  Predicate,
  ResourceGeneration,
  TargetQuery,
  TargetRef,
  TypedResource,
  ValueSpec,
} from "@mc/engine";
import { resource, type AbilityOptions, type Amount, amount } from "../../dsl/index.js";

/**
 * Small local helpers for the Hulk (`hlk`) pack: thin composition over `AbilityCost`/`EffectSpec`/`Predicate`/
 * `TargetRef` shapes that are already landed in `@mc/engine` (docs/phase7-wave1.md §3) but have no `dsl/` builder of
 * their own yet. Each one just returns plain engine data, the same as every builder in `dsl/`, per
 * docs/phase7-wave1-scripting.md §4: this is composing existing primitives, not adding a new one. Local to this
 * pack's folder — never imported by another pack.
 */

/**
 * "If you paid for this card using only [X] resources" (Hulk Smash, Sub-Orbital Leap, Unstoppable Force, Drop
 * Kick). Landed engine primitive `Predicate.paidWithOnly` (docs/phase7-wave1.md §3.10; `select.ts` case
 * "paidWithOnly"; `packages/engine/src/play-restrictions.test.ts`), no `dsl/values.ts` wrapper yet.
 */
export const paidOnly = (resourceType: TypedResource): Predicate => ({ kind: "paidWithOnly", resource: resourceType });

/**
 * A ref matches a query wherever it is, not just in play (Abomination: "If a [physical] resource was discarded
 * this way" — the discarded card is in the deck's discard pile, not in play, by the time this is checked). Landed
 * `Predicate.refMatches.anywhere` (`spec.ts`, documented against exactly this "card in a discard pile" shape), no
 * `dsl/values.ts` wrapper yet (the exported `refMatches` omits `anywhere`).
 */
export const refMatchesAnywhere = (ref: TargetRef, q: TargetQuery): Predicate => ({
  kind: "refMatches",
  ref,
  query: q,
  anywhere: true,
});

/**
 * "The enemy with the highest ATK" / "the hero or ally with the highest ATK" (Clash of the Titans). Landed
 * `TargetRef.superlative` (`spec.ts`, `select.ts`), no `dsl/values.ts` wrapper yet. `measure` is evaluated once per
 * candidate bound to slot `"candidate"` (the engine's own default), matched by `dsl`'s `chosen("candidate")`.
 */
export const superlative = (order: "highest" | "lowest", among: TargetRef, measure: ValueSpec): TargetRef => ({
  kind: "superlative",
  among,
  order,
  measure,
});

/**
 * "The enemy … attacks the hero or ally with the highest ATK" (Clash of the Titans): an `enemyAttack` against a
 * specific character instead of a player. Landed `EffectSpec.enemyAttack.targetCharacter` (`spec.ts`, documented
 * against this exact card), not yet exposed by the `enemyAttack()` builder in `dsl/effects.ts` (which only takes
 * `against`/`bind`/`additionalResolution`).
 */
export const enemyAttackCharacter = (enemies: TargetRef, targetCharacter: TargetRef, bind?: string): EffectSpec => ({
  kind: "enemyAttack",
  enemies,
  targetCharacter,
  ...(bind ? { bind } : {}),
});

/**
 * "Move 1 threat from a scheme to here" (Beat Cop). Landed `EffectSpec.moveThreat` (`spec.ts`, documented against
 * this exact card; `apply-effect.ts` case "moveThreat"), no `dsl/effects.ts` wrapper yet.
 */
export const moveThreat = (from: TargetRef, to: TargetRef, n?: Amount): EffectSpec => ({
  kind: "moveThreat",
  from,
  to,
  ...(n !== undefined ? { amount: amount(n) } : {}),
});

/**
 * "… generate a [physical] resource for an Attack event" (Martial Prowess): a resource ability usable only while
 * paying for a matching card. Landed `AbilityDefinition.generatesFor` (`abilities.ts`; `packages/engine/src/
 * play-restrictions.test.ts`'s Gauntlet stub), not yet exposed as an option by the `resource()` builder in
 * `dsl/abilities.ts`.
 */
export const resourceForCard = (
  generates: ResourceGeneration,
  cardFilter: TargetQuery,
  options: AbilityOptions = {},
): AbilityDefinition => ({
  ...resource(generates, options),
  generatesFor: cardFilter,
});
