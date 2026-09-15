import type { EffectSpec, PlayerRef, TargetRef, ValueSpec } from "@mc/engine";
import { amount, bindTargets, chooseTarget, chosen, each, query, threatOn, you, type Amount } from "../../dsl/index.js";

/**
 * Small local helpers for The Wrecking Crew (`twc`) scenario pack: thin composition over `EffectSpec`/`TargetRef`/
 * `ValueSpec` shapes already landed in `@mc/engine` (docs/phase7-wave1.md §3.1, §3.2, §3.12) but with no
 * `dsl/effects.ts`/`dsl/values.ts` wrapper yet. Local to this pack's folder — never imported by another pack
 * (docs/phase7-wave1-scripting.md), copied rather than shared, same convention as `wave1/gob/local.ts`.
 */

/**
 * "The villain corresponding to the attached side scheme" (Held Hostage). Landed `TargetRef.villainOfSideScheme`
 * (`spec.ts`), no `dsl/values.ts` wrapper yet.
 */
export const villainOfSideScheme = (scheme: TargetRef): TargetRef => ({ kind: "villainOfSideScheme", scheme });

/**
 * "His side scheme" / "his corresponding side scheme" (Radioactive Buildup, Wrecker's Command, every "place threat
 * on [named villain]'s side scheme" card). Landed `TargetRef.signatureSideSchemeOf` (`spec.ts`), no
 * `dsl/values.ts` wrapper yet.
 */
export const signatureSideSchemeOf = (villain: TargetRef): TargetRef => ({ kind: "signatureSideSchemeOf", villain });

/**
 * "The X with the highest/lowest Y" (`TargetRef.superlative`, docs/phase7-wave1.md §3.12). Copied from
 * `wave1/gob/local.ts`'s identical helper, extended with an optional `ties` so a superlative that must resolve to
 * exactly one candidate without asking anyone (Oversized Hands' "the support … with the highest cost") can say so.
 */
export const superlative = (order: "highest" | "lowest", among: TargetRef, measure: ValueSpec, opts: { readonly slot?: string; readonly ties?: "first" } = {}): TargetRef => ({
  kind: "superlative",
  among,
  order,
  measure,
  ...(opts.slot ? { slot: opts.slot } : {}),
  ...(opts.ties ? { ties: opts.ties } : {}),
});

/** "The villain whose side scheme has the least/most threat" (Escaped Convict, Buddy System, Get Wrecked!, …). */
export const leastThreatVillain: TargetRef = superlative("lowest", each(query("villain")), threatOn(signatureSideSchemeOf(chosen("candidate"))));
export const mostThreatVillain: TargetRef = superlative("highest", each(query("villain")), threatOn(signatureSideSchemeOf(chosen("candidate"))));

/** "The side scheme with the least/most threat" (Magic Crowbar, Lightning Blast, Tactical Prowess). */
export const leastThreatSideScheme: TargetRef = superlative("lowest", each(query("sideScheme")), threatOn(chosen("candidate")));
export const mostThreatSideScheme: TargetRef = superlative("highest", each(query("sideScheme")), threatOn(chosen("candidate")));

/**
 * "Choose the villain whose side scheme has the least/most threat" (Buddy System) and Breakout 1B's own "move the
 * active counter to the villain whose scheme has the most threat (if there is a tie, the first player chooses)":
 * `bindTargets` the superlative candidates, then `chooseTarget` among them — the tip in
 * docs/phase7-wave1-scripting.md for "the X with the highest/lowest Y naming one card". `pickedVillain` (below)
 * reads the answer. Two call sites reuse the same slot names safely: neither ability nests another "choose a
 * villain" inside it.
 */
const VILLAIN_CANDIDATES_SLOT = "twc-villain-candidates";
/** The slot `pickVillainBy` binds its answer to — exported so a caller can say "no other villain is in play" via `excludeSlots`. */
export const VILLAIN_PICK_SLOT = "twc-villain-pick";
export const pickVillainBy = (order: "highest" | "lowest", chooser: PlayerRef = you): EffectSpec[] => [
  bindTargets(VILLAIN_CANDIDATES_SLOT, superlative(order, each(query("villain")), threatOn(signatureSideSchemeOf(chosen("candidate"))))),
  chooseTarget(VILLAIN_PICK_SLOT, query("villain", { inSlot: VILLAIN_CANDIDATES_SLOT }), { chooser }),
];
export const pickedVillain: TargetRef = chosen(VILLAIN_PICK_SLOT);

/**
 * "Move all threat from the side scheme with the least threat to the side scheme with the most threat" (Tactical
 * Prowess). Landed `EffectSpec.moveThreat` (`spec.ts`, its doc comment names this exact card), no `dsl/effects.ts`
 * wrapper yet. `bind`: `<bind>.made`, `<bind>.amount` (placed), `<bind>.forcedResponses`.
 */
export const moveThreat = (from: TargetRef, to: TargetRef, opts: { readonly amount?: Amount; readonly bind?: string } = {}): EffectSpec => ({
  kind: "moveThreat",
  from,
  to,
  ...(opts.amount !== undefined ? { amount: amount(opts.amount) } : {}),
  ...(opts.bind ? { bind: opts.bind } : {}),
});

/**
 * "Deal damage equal to that card's printed cost" (Headbutt); "the support you control with the highest cost"
 * (Oversized Hands, as a `superlative` measure). Landed `ValueSpec.printedCost` (`spec.ts`, its doc comment names
 * Headbutt), no `dsl/values.ts` wrapper yet.
 */
export const printedCostOf = (of: TargetRef): ValueSpec => ({ kind: "printedCost", of });

/**
 * "For each different card type discarded this way" (Leading the Charge). Landed `ValueSpec.distinctCardTypes`
 * (`spec.ts`), no `dsl/values.ts` wrapper yet.
 */
export const distinctCardTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "distinctCardTypes", cards: cardsRef });

/**
 * "Remove each stunned and confused status card from each villain" (Uncanny Resilience): the opposite of
 * `giveStatus`/`stun`/`confuse`/`giveTough`. Landed `EffectSpec.removeStatus` (`spec.ts`), no `dsl/effects.ts`
 * wrapper yet.
 */
export const removeStatus = (target: TargetRef, status: "stunned" | "confused" | "tough"): EffectSpec => ({ kind: "removeStatus", target, status });

/**
 * "That villain attacks you after this attack. That attack does not get a boost card" (Escaped Convict).
 * `enemyAttack`'s `dsl/effects.ts` wrapper exposes `against`/`bind`/`additionalResolution` but not `boost`/`after`
 * (`spec.ts` `EffectSpec.enemyAttack`), which this exact card needs together.
 */
export const enemyAttackAfterThisNoBoost = (enemies: TargetRef, against: PlayerRef): EffectSpec => ({
  kind: "enemyAttack",
  enemies,
  against,
  boost: false,
  after: "currentActivation",
});
