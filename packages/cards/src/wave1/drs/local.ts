import type { CardSelector, CardZoneQuery, EffectSpec, Predicate, TargetQuery, TargetRef, ValueSpec } from "@mc/engine";
import { amount, you, type Amount } from "../../dsl/index.js";
import type { PlayerRef } from "@mc/engine";

/**
 * Small helpers local to the Doctor Strange (`drs`) pack, composing engine primitives that landed without DSL
 * sugar of their own (docs/phase7-wave1-scripting.md "Reprints" / "the rule: missing primitive"). None of these
 * are new engine primitives — every `kind` here is already a landed `EffectSpec`/`CardSelector`/`ValueSpec`
 * (docs/phase7-wave1.md §3.5's Invocation-deck write-up and §3.12's value vocabulary) — they just don't have a
 * `dsl/effects.ts`/`dsl/values.ts` wrapper yet, and that file is shared (never edited by a pack agent). Modeled on
 * `wave1/thor/local.ts`.
 */

/** The name of Doctor Strange's separate deck, matching `HeroIdentityCard.separateDecks[0].name` (09001a). */
export const INVOCATION = "Invocation";

/**
 * "The top card of the Invocation deck" as a `CardSelector`, for `moveCards`/`chooseCards`/`tuckCards` (docs/
 * phase7-wave1.md §3.5, engine `packages/engine/src/separate-deck.test.ts`). No `dsl/effects.ts` wrapper yet.
 */
export const invocationTop = (n: Amount = 1, player: PlayerRef = you): CardSelector => ({
  kind: "separateDeck",
  player,
  name: INVOCATION,
  top: amount(n),
});

/**
 * "The top card of the Invocation deck" as a `CardZoneQuery`, for `payPrintedCostOf`'s `from` (Spell Mastery,
 * Master of the Mystic Arts). `player` is a literal `"you" | "any"` on `CardZoneQuery`, not a `PlayerRef`.
 */
export const invocationTopCost = (top = 1): CardZoneQuery => ({
  zone: "separateDeck",
  separateDeck: INVOCATION,
  player: "you",
  top,
});

/**
 * "Resolve the 'Special' ability on [a card wherever it is]" (Spell Mastery, Master of the Mystic Arts): the
 * `of: TargetRef` half of `EffectSpec.resolveSpecials` (engine `spec.ts`), which `dsl/effects.ts`'s `resolveSpecials`
 * doesn't expose yet (it only builds the `cards: TargetQuery` half, for "each … upgrade you control").
 */
export const resolveSpecialsOf = (of: TargetRef): EffectSpec => ({ kind: "resolveSpecials", of });

/** "Printed resource cost" of a specific card (`ValueSpec.printedCost`, docs/phase7-wave1.md §3.12; Thoughtcasting). */
export const printedCostOf = (of: TargetRef): ValueSpec => ({ kind: "printedCost", of });

/** The candidate a `superlative` ref is currently measuring (its default `slot`). */
export const candidateSlot: TargetRef = { kind: "slot", slot: "candidate" };

/**
 * "The X with the highest/lowest Y" (`TargetRef.superlative`, docs/phase7-wave1.md §3.12) — "a card from your hand
 * with the highest cost" (Thoughtcasting). No `dsl` wrapper yet. Ties resolve to every tied card by default.
 */
export const superlativeAmong = (
  among: TargetRef,
  order: "highest" | "lowest",
  measure: ValueSpec,
  opts: { readonly slot?: string; readonly ties?: "all" | "first" } = {},
): TargetRef => ({ kind: "superlative", among, order, measure, ...opts });

/**
 * `Predicate.refMatches` with `anywhere: true` (docs/phase7-wave1.md §3.12): asks about a card that has already
 * left play (discarded), unlike the bare `refMatches` in `dsl/values.ts`, which only reads cards currently in play.
 */
export const refMatchesAnywhere = (ref: TargetRef, q: TargetQuery): Predicate => ({
  kind: "refMatches",
  ref,
  query: q,
  anywhere: true,
});

/**
 * "Discard 1 status card from [a character]" (The Night Nurse, 09019): the raw `EffectSpec.removeStatus` (landed,
 * `packages/engine/src/spec.ts`), which `dsl/effects.ts` doesn't wrap yet — the same gap `kit.ts`'s Vapors of
 * Valtorr doc comment calls out, minus the "replace with a *different* status" half that card alone needs.
 */
export const removeStatusOf = (target: TargetRef, status: "stunned" | "confused" | "tough"): EffectSpec => ({
  kind: "removeStatus",
  target,
  status,
});

/**
 * "Cancel its boost icons" (Foiled!, 09038): `EffectSpec.cancelBoostIcons` (landed, `spec.ts`) has no `dsl/effects.ts`
 * wrapper yet. Copied from `wave1/msm/pack-cards.ts`'s identical local helper rather than imported (pack modules
 * don't import each other — docs/phase7-wave1-scripting.md).
 */
export const cancelBoostIcons = (bind?: string): EffectSpec => ({
  kind: "cancelBoostIcons",
  ...(bind ? { bind } : {}),
});
