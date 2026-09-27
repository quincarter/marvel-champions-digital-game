import { trait } from "@mc/content";
import type { EffectSpec, TargetRef } from "@mc/engine";
import {
  activationIs,
  applyRuleUntil,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  constant,
  countsAs,
  defineAbilities,
  discard,
  each,
  exists,
  firstPlayer,
  gainsKeyword,
  gets,
  heroAction,
  ifThen,
  moveCounters,
  not,
  placeThreat,
  query,
  resolveSpecialsOf,
  revealCard,
  self,
  spend,
  superlative,
  threatOn,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const SYMBIOTE = trait("SYMBIOTE");
const symbioteEnvironmentInPlay = exists(query("environment", { trait: SYMBIOTE }));

/**
 * "Move the glider counter to the main scheme with the most threat" (Symbiotic Berserker's own boost, Joy Ride's own
 * When Revealed, `sm` 27121/27125): the mirror of `main-scheme.ts`'s own `moveToLeastThreatScheme`, kept local to
 * this module rather than exported from there (this agent's brief: don't touch `main-scheme.ts`). Ties broken by the
 * first player (MC27 p. 21 FAQ, docs/phase7-wave5.md §3.3's own "ties are the first player's"), the same as the
 * least-threat case. Returns the effects plus the `"gliderTo"` slot so a caller can read "that scheme" afterward
 * (Symbiotic Berserker's own "Place 1 threat on that scheme", Joy Ride's own "Resolve that scheme's 'Special'
 * ability").
 */
const MOST_THREAT_SCHEMES = superlative("highest", each(query("mainScheme")), threatOn(chosen("candidate")), {
  ties: "all",
});
const moveGliderToMostThreatScheme = (): readonly EffectSpec[] => [
  bindTargets("mostThreat", MOST_THREAT_SCHEMES),
  chooseTarget("gliderTo", { inSlot: "mostThreat" }, { chooser: firstPlayer }),
  moveCounters(each(query("mainScheme", { hasCounter: "glider" })), chosen("gliderTo"), "glider"),
];
const gliderTo: TargetRef = chosen("gliderTo");

/** "The scheme with the glider counter" (Spreading Panic 27126, and Joy Ride 27125 after it moves the counter). */
const SCHEME_WITH_GLIDER = each(query("mainScheme", { hasCounter: "glider" }));

/**
 * Venom Goblin's own encounter set (`sm` 27120–27126, MC27 p. 17, docs/phase7-wave5.md §1.1/§2.2/§3.3/§3.4/§3.9):
 * We Are One, Symbiotic Berserker, Symbiotic Monstrosity, Symbiotic Thrall, Festering Mass, Joy Ride and Spreading
 * Panic.
 */
export const VENOM_GOBLIN_ENCOUNTER_SET = defineAbilities({
  // We Are One (27120, attachment to Venom Goblin; +3 ATK/+3 SCH and "Attach to Venom Goblin" are data) — Hero
  // Action: Spend [energy][mental][physical] printed resources → discard this card (Improvised Weapons's own
  // precedent, `wave5/sm/venom/symbiotic-strength.ts` 27164).
  "27120.we-are-one-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  // Symbiotic Berserker (27121, minion; ATK 3 is data) — [star] While a [Symbiote] environment is in play, Symbiotic
  // Berserker gains quickstrike.
  "27121.symbiotic-berserker-constant": constant(
    gainsKeyword({ name: "quickstrike" }, { self: true }, { while: symbioteEnvironmentInPlay }),
  ),
  // [star] Boost: Move the glider counter to the main scheme with the most threat. Place 1 threat on that scheme.
  "27121.boost": boost(...moveGliderToMostThreatScheme(), placeThreat(1, gliderTo)),

  // Symbiotic Monstrosity (27122, minion; Retaliate 1/Steady/Toughness are data) — [star] While a [Symbiote]
  // environment is in play, Symbiotic Monstrosity gets +3 hit points.
  "27122.symbiotic-monstrosity-constant": constant(gets("hp", 3, { self: true }, { while: symbioteEnvironmentInPlay })),
  // [star] Boost: If this activation is an attack, this attack deals indirect damage (Sand Blast's own precedent,
  // `wave5/sm/sandman/villain.ts`: `applyRuleUntil({ kind: "attacksDealIndirectDamage", attacker: … }, "endOfAttack")`;
  // the boost is revealed mid-activation, so the default "current attack" scope applies, not `{ attack: "initiated" }`
  // which is for an effect that starts a new one). Unlike Sand Blast — a villain-stage ability whose own `self` *is*
  // the attacking villain — this ability lives on the boost card itself, so `self` here would name the boost card,
  // not whichever enemy drew it (a minion can be dealt any other minion's or the villain's own copy as its boost
  // card, and there is no `host`/`hostOfSelf`-style ref from a boost card back to the enemy holding it: those read
  // `attachedTo`, which a boost card in the `boost` zone never sets — confirmed empirically: `attacker: { self: true
  // }` here left `attacksDealIndirectDamage` never matching the villain, and the attack resolved as a normal single
  // `dealDamage`). An unconstrained `attacker` query (`{}`, matches any) is still exactly "this attack": the lasting
  // effect's own duration (`endOfEvent` on the enemyAttack frame this boost card's activation is inside) already
  // scopes it to the one attack in progress, and activations never overlap (RRG 1.8 "Activation", p. 6), so nothing
  // else can be resolving under that same window for the unconstrained match to catch by mistake.
  "27122.boost": boost(
    ifThen(activationIs("attack"), applyRuleUntil({ kind: "attacksDealIndirectDamage", attacker: {} }, "endOfAttack")),
  ),

  // Symbiotic Thrall (27123, minion; Guard is data) — While a [Symbiote] environment is in play, Symbiotic Thrall
  // gains patrol.
  "27123.symbiotic-thrall-constant": constant(
    gainsKeyword({ name: "patrol" }, { self: true }, { while: symbioteEnvironmentInPlay }),
  ),
  // [star] Boost: Place 1 threat on each main scheme without the glider counter (`excluding`: the mirror of `hasCounter`,
  // `packages/engine/src/spec.ts` `TargetQuery.excluding`).
  "27123.boost": boost(placeThreat(1, each(query("mainScheme", { excluding: SCHEME_WITH_GLIDER })))),

  // Festering Mass (27124, side scheme; starting threat/acceleration icon are data) — While there are no other
  // [Symbiote] environments in play, this card is considered a [Symbiote] environment (the DSL's own worked example
  // for this exact card, `dsl/abilities.ts` `countsAs`'s own doc comment and `wave5-primitives.test.ts` §3.9).
  "27124.festering-mass-constant": constant(
    countsAs({ self: true }, ["environment"], {
      traits: [SYMBIOTE],
      while: not(exists(query("environment", { trait: SYMBIOTE, self: false }))),
    }),
  ),
  // [star] Boost: Reveal this card (Now We're Angry!'s own precedent, `wave5/sm/venom/encounter-set.ts` 27078).
  "27124.boost": boost(revealCard(self, you)),

  // Joy Ride (27125, side scheme; Hinder 2[per_hero]/hazard icon are data) — When Revealed: Move the glider token
  // to the main scheme with the most threat. Resolve that scheme's "Special" ability (this card's own worked
  // example for `moveCounters`+`superlative`, `dsl/wave5-primitives.test.ts` §3.3).
  "27125.when-revealed": whenRevealed(...moveGliderToMostThreatScheme(), resolveSpecialsOf(gliderTo)),

  // Spreading Panic (27126, treachery; Surge is data) — When Revealed: Resolve the "Special" ability of the scheme
  // with the glider counter.
  "27126.when-revealed": whenRevealed(resolveSpecialsOf(SCHEME_WITH_GLIDER)),
  // [star] Boost: Resolve the "Special" ability of the scheme with the glider counter.
  "27126.boost": boost(resolveSpecialsOf(SCHEME_WITH_GLIDER)),
});
