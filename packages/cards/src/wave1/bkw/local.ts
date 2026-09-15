import { trait } from "@mc/content";
import type { AbilityDefinition, EffectSpec, EventPattern, TargetQuery, TargetRef } from "@mc/engine";

/**
 * Small helpers local to the Black Widow (`bkw`) pack, composing engine primitives that landed without DSL sugar
 * of their own (docs/phase7-wave1-scripting.md "Reprints" / "the rule: missing primitive"). None of these are new
 * engine primitives — every `kind`/field here is already landed (see docs/phase7-wave1.md §3's write-ups, several
 * of which name these exact bkw cards) — they just don't have a `dsl/abilities.ts`/`dsl/effects.ts`/`dsl/values.ts`
 * wrapper yet, and those files are shared (never edited by a pack agent). Mirrors `../thor/local.ts`'s shape.
 */

export const PREPARATION = trait("Preparation");
/** Every category a "Preparation card" could print as (the trait isn't restricted to upgrades, even though every
 * bkw card that currently carries it happens to be one). */
export const PREPARATION_CARD: TargetQuery = { categories: ["ally", "event", "support", "upgrade"], trait: PREPARATION };

/**
 * "After you resolve the ability of a Preparation card you control" (Black Widow's Widowmaker, Synth-Suit —
 * both errata'd RRG 1.8 p. 66 / ruling Feb 28, 2026 (2), "trigger" → "resolve"). Engine trigger event
 * `abilityResolved` (`packages/engine/src/trigger-events.ts`, named for this exact errata); no `dsl/abilities.ts`
 * `on.*` wrapper yet (`packages/engine/src/triggers-wave1.test.ts`'s `RESOLVE_WATCH` stub is the same shape).
 */
export const onAbilityResolvedOf = (source: TargetQuery): EventPattern => ({ on: "abilityResolved", playerIs: "controller", sourceIs: source });

/**
 * "After you play a Preparation card" (Mission Prep, Natasha Romanoff). `dsl/abilities.ts`'s `on.youPlayThis` only
 * covers a card's own play, not "a card matching a query" — this is the same `cardPlayed` event, generalized.
 */
export const onCardPlayed = (target: TargetQuery): EventPattern => ({ on: "cardPlayed", playerIs: "controller", targetIs: target });

/**
 * "When you reveal a treachery" (Grappling Hook) / "When you reveal an encounter card" (Spycraft). `dsl/abilities.ts`'s
 * `on.encounterCardRevealed` has no `playerIs` — Core's own "Black Widow" (01075) and "Get Behind Me!" (01078) print
 * no "you" and so don't need it, but these two bkw cards do.
 */
export const youReveal = (what?: TargetQuery): EventPattern => ({ on: "encounterCardRevealing", playerIs: "controller", ...(what ? { targetIs: what } : {}) });

/**
 * "When a boost card is turned faceup" (Attacrobatics) / "After a boost card is turned faceup" (Target Acquired).
 * Engine event `boostCardTurnedFaceup` (docs/phase7-wave1.md §3.9, "landed"); no `dsl/abilities.ts` wrapper yet.
 * `eventAtLeast: { boostIcons: 1 }` is FAQ "Attacrobatics (#6)" (RRG 1.8 p. 59): cancelling icons on a 0-icon
 * boost card is not offered.
 */
export const onBoostCardTurnedFaceup = (opts: { readonly requireIcons?: boolean } = {}): EventPattern => ({
  on: "boostCardTurnedFaceup",
  ...(opts.requireIcons ? { eventAtLeast: { boostIcons: 1 } } : {}),
});

/**
 * "Cancel the boost icons on that card" (Attacrobatics). `bind`: `<bind>.made`, `<bind>.amount` (icons cancelled —
 * "Deal 1 damage … for each boost icon canceled this way"). Engine primitive `EffectSpec.cancelBoostIcons`
 * (`packages/engine/src/spec.ts`, docs/phase7-wave1.md §3.9); no `dsl/effects.ts` wrapper yet.
 */
export const cancelBoostIcons = (bind?: string): EffectSpec => ({ kind: "cancelBoostIcons", ...(bind ? { bind } : {}) });
/** "Cancel that card's boost ability" (Target Acquired). Engine primitive `EffectSpec.cancelBoostAbility`. */
export const cancelBoostAbility = (): EffectSpec => ({ kind: "cancelBoostAbility" });

/**
 * "… generate a [wild] resource for a Preparation card" (Black Widow's Gauntlet, docs/phase7-wave1.md §3.10 names
 * this exact card). `AbilityDefinition.generatesFor` is landed (`packages/engine/src/abilities.ts`); `dsl/abilities.ts`'s
 * `resource()` builder doesn't expose it yet, so this composes it onto an already-built resource ability.
 */
export const generatesFor = (def: AbilityDefinition, filter: TargetQuery): AbilityDefinition => ({ ...def, generatesFor: filter });

/**
 * "The Preparation card you control with the highest cost" (Burn Notice). `TargetRef.superlative` and
 * `ValueSpec.printedCost` are landed (`packages/engine/src/spec.ts`, whose own `superlative` doc comment names
 * this exact card); no `dsl/values.ts` wrapper yet. Ties resolve to every tied card (the `superlative` doc
 * comment's documented default — Burn Notice's "the" is singular, but nothing in its text breaks a tie itself).
 */
export const theCardWithHighestCost = (pool: TargetQuery): TargetRef => ({
  kind: "superlative",
  among: { kind: "each", query: pool },
  order: "highest",
  measure: { kind: "printedCost", of: { kind: "slot", slot: "candidate" } },
});
