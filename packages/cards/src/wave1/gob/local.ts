import { trait } from "@mc/content";
import type { AbilityDefinition, EffectSpec, EventPattern, Predicate, PlayerRef, TargetQuery, TargetRef, ValueSpec } from "@mc/engine";
import { amount, flatten, self, you, type Amount, type EffectArg } from "../../dsl/index.js";

/**
 * Small local helpers for the Green Goblin (`gob`) scenario pack: thin composition over `EffectSpec`/`Predicate`/
 * `TargetRef`/`AbilityTriggerSpec` shapes already landed in `@mc/engine` (docs/phase7-wave1.md §3.3, §3.4, §3.7,
 * §3.8, §3.12) but with no `dsl/effects.ts`/`dsl/values.ts` wrapper yet. Local to this pack's folder — never
 * imported by another pack (docs/phase7-wave1-scripting.md).
 */

export const GOBLIN_TRAIT = trait("GOBLIN");
export const CRIMINAL_ENTERPRISE = "Criminal Enterprise";
export const STATE_OF_MADNESS = "State of Madness";

/** "The environment": every card in play in the `environment` category (Risky Business's own Criminal Enterprise/State of Madness). Copied from `packages/engine/src/flip.test.ts`'s identical `theEnvironment`. */
export const theEnvironment: TargetRef = { kind: "each", query: { categories: ["environment"] } };

/**
 * "Flip Norman Osborn and Criminal Enterprise" / "flip Green Goblin and State of Madness" (RRG 1.8 "Flip", p. 20;
 * docs/phase7-wave1.md §3.3/§3.4). Landed `EffectSpec.flipCard` (`spec.ts`), no `dsl/effects.ts` wrapper yet.
 */
export const flipCard = (target: TargetRef): EffectSpec => ({ kind: "flipCard", target });

/**
 * "If there are no infamy/madness counters here, …" (docs/phase7-wave1.md §3.4): a condition-triggered forced
 * ability, `AbilityTriggerSpec.stateCheck` (landed, `abilities.ts`), edge-triggered and re-armed once the condition
 * has been false. No `dsl/abilities.ts` wrapper yet. Copied from `packages/engine/src/flip.test.ts`'s `noCounters`.
 */
export const stateCheck = (when: Predicate, ...effects: readonly EffectArg[]): AbilityDefinition => ({
  trigger: { kind: "stateCheck", when },
  effects: flatten(effects),
});
export const noCounters = (of: TargetRef, counterType: string): Predicate => ({
  kind: "not",
  of: { kind: "counterAtLeast", of, counterType, amount: 1 },
});

/**
 * "After this card enters play **or flips to this face**" / "after this card flips to this face".
 *
 * `dsl/abilities.ts`'s `after.*` has no wrapper for `cardFlipped`, and only a double-sided card needs one.
 * Criminal Enterprise's front face enters play at setup and can also be flipped back to, so it listens to both;
 * State of Madness is a back face only ever reached by a flip, so it listens to the flip alone. Both shapes are
 * the ones `packages/engine/src/flip.test.ts` proves against stubs.
 */
export const entersPlayOrFlipsHere: EventPattern = { on: ["cardEntersPlay", "cardFlipped"], selfIs: "target" };
export const flipsHere: EventPattern = { on: "cardFlipped", selfIs: "target" };

/**
 * "When Revealed (Face Name)" (docs/phase7-wave1.md §3.3): reads a villain's side or a flipped encounter card's
 * face. Landed `Predicate.faceNamed` (`spec.ts`), no `dsl/values.ts` wrapper yet.
 */
export const faceNamed = (of: TargetRef, name: string): Predicate => ({ kind: "faceNamed", of, name });

/**
 * "Remove N [counterType] counter(s) from [target]" (Norman Osborn's Forced Interrupt, the infamy/madness boost
 * pattern): landed `EffectSpec.removeCounters` (`spec.ts`), no `dsl/effects.ts` wrapper yet (only `addCounters` is
 * exposed there).
 */
export const removeCounters = (counterType: string, n: Amount, target: TargetRef = self): EffectSpec => ({
  kind: "removeCounters",
  target,
  counterType,
  amount: amount(n),
});

/**
 * "Deal N indirect damage to each player" / "… to you" (RRG 1.8 "Indirect Damage", p. 24; docs/phase7-wave1.md
 * §3.7). Landed `EffectSpec.dealIndirectDamage` (`spec.ts`), no `dsl/effects.ts` wrapper yet.
 */
export const dealIndirectDamage = (n: Amount, to: PlayerRef | "group", opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "dealIndirectDamage",
  to,
  amount: amount(n),
  ...(opts.bind ? { bind: opts.bind } : {}),
});

/**
 * "Discard N cards from the encounter deck" (Electro, Lightning Bolt, Shock Therapy, Wicked Ambitions): landed
 * `EffectSpec.discardEncounterCards` (`spec.ts`), with the reshuffle-when-empty semantics RRG 1.8 "Encounter Deck"
 * (p. 17) describes. No `dsl/effects.ts` wrapper yet.
 */
export const discardEncounterCards = (
  count: Amount,
  opts: { readonly bind?: string; readonly forEachDiscarded?: { readonly slot: string; readonly effects: readonly EffectArg[] } } = {},
): EffectSpec => ({
  kind: "discardEncounterCards",
  count: amount(count),
  ...(opts.bind ? { bind: opts.bind } : {}),
  ...(opts.forEachDiscarded ? { forEachDiscarded: { slot: opts.forEachDiscarded.slot, effects: flatten(opts.forEachDiscarded.effects) } } : {}),
});

/**
 * "After this activation ends, shuffle this card into the encounter deck" (Goblin Knight, Monster's boost): the
 * counterpart of `atEndOfAttack` for a scheme activation too. Landed `EffectSpec.atEndOfActivation` (`spec.ts`), no
 * `dsl/effects.ts` wrapper yet.
 */
export const atEndOfActivation = (...effects: readonly EffectArg[]): EffectSpec => ({ kind: "atEndOfActivation", effects: flatten(effects) });

/** "Where X is equal to the villain's stage number" (Death from Above, Wicked Ambitions, Regenerative Healing). Landed `ValueSpec.villainStageNumber` (`spec.ts`), no `dsl/values.ts` wrapper yet. */
export const villainStageNumberOf = (of?: TargetRef): ValueSpec => ({ kind: "villainStageNumber", ...(of ? { of } : {}) });

/**
 * A ref matches a query wherever it is, not just in play (the discarded card in "if that card is a Goblin minion" —
 * Goblin Knight, Electromagnetic Pulse, Wicked Ambitions). Landed `Predicate.refMatches.anywhere` (`spec.ts`), no
 * `dsl/values.ts` wrapper yet. Copied from `wave1/hlk/local.ts`'s identical helper.
 */
export const refMatchesAnywhere = (ref: TargetRef, q: TargetQuery): Predicate => ({ kind: "refMatches", ref, query: q, anywhere: true });

/**
 * "The enemy … attacks the hero with the fewest hit points remaining" (Mad Genius): an `enemyAttack` against a
 * specific character instead of a player. Landed `EffectSpec.enemyAttack.targetCharacter` (`spec.ts`). Copied from
 * `wave1/hlk/local.ts`'s identical helper.
 */
export const enemyAttackCharacter = (enemies: TargetRef, targetCharacter: TargetRef, bind?: string): EffectSpec => ({
  kind: "enemyAttack",
  enemies,
  targetCharacter,
  ...(bind ? { bind } : {}),
});

/**
 * "The X with the highest/lowest Y" (`TargetRef.superlative`, docs/phase7-wave1.md §3.12). Copied from
 * `wave1/hlk/local.ts`'s identical helper (its default `slot` is "candidate", matched by `dsl`'s `chosen("candidate")`).
 */
export const superlative = (order: "highest" | "lowest", among: TargetRef, measure: ValueSpec): TargetRef => ({ kind: "superlative", among, order, measure });

/**
 * "The first [X] [discarded/found] this way" (Unleashing the Mutagen 1B, Overrun's own "first" isn't needed but
 * Mutagen Formula's own setup and When Completed are): every candidate in `among` measures equally, so `ties:
 * "first"` (docs/phase7-wave1.md §3.12: "takes the first candidate in the pool's stable order") picks the first
 * one without asking anyone. `among` should already be filtered to just the eligible candidates (e.g. via
 * `selectCards` with a `cards(ref, filter)` selector) — this never itself filters by trait/type.
 */
export const firstOf = (among: TargetRef): TargetRef => ({ kind: "superlative", among, order: "highest", measure: { kind: "const", value: 0 }, ties: "first" });

/**
 * "The villain attacks you. If you are in alter-ego form, do not give the villain a boost card for this
 * activation" (I See You): `EffectSpec.enemyAttack.boost: false`, documented against this exact card (`spec.ts`),
 * not yet exposed by the `enemyAttack()` builder in `dsl/effects.ts` (which only takes `against`/`bind`/
 * `additionalResolution`).
 */
export const enemyAttackNoBoost = (enemies: TargetRef, against: PlayerRef): EffectSpec => ({ kind: "enemyAttack", enemies, against, boost: false });

/**
 * "If you cannot, this card gains surge" (Goblin Glider): whether the ability's own card actually attached this
 * reveal. Landed `Predicate.isAttached` (`spec.ts`; `packages/engine/src/attachment-hosts.test.ts`'s identical
 * Goblin Glider fixture), no `dsl/values.ts` wrapper yet.
 */
export const isAttached = (of: TargetRef): Predicate => ({ kind: "isAttached", of });

/** A `whenCompleted` ability (RRG 1.8 "When Completed Abilities", p. 48; docs/phase7-wave1.md §3.8). No `dsl/abilities.ts` wrapper yet. */
export const whenCompleted = (...effects: readonly EffectArg[]): AbilityDefinition => ({ trigger: { kind: "whenCompleted" }, effects: flatten(effects) });
