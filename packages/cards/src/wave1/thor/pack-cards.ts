import { trait } from "@mc/content";
import {
  action,
  addCounters,
  after,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  coveredByEngineRule,
  constant,
  costModifier,
  countOf,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  discard,
  draw,
  encounterCards,
  exhaustCardsCost,
  exhaustThis,
  gets,
  giveTough,
  hasTrait,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  ifElse,
  ifThen,
  modifyStat,
  moveCards,
  on,
  paidWith,
  query,
  ready,
  removeCounter,
  response,
  scaled,
  selectCards,
  self,
  spend,
  statOf,
  TRAIT,
  yourIdentity,
  YOUR_HERO,
} from "../../dsl/index.js";
import { engage, reorderCards } from "./local.js";

/**
 * Generic-aspect filler cards bundled in the Thor pack, printed with a plain aspect (`aggression`/`justice`/
 * `leadership`/`protection`/`basic`), not locked to Thor's own deck — see `kit.ts`'s docblock. "Chase Them Down"
 * (06013), "The Power of Aggression" (06016) and "Avengers Mansion" (06025) are Core reprints aliased from
 * `../reprints.ts`. Energy/Genius/Strength (06022–06024) print no ability text.
 */
export const THOR_PACK_CARDS = defineAbilities({
  // Hercules — Reduce the cost to play Hercules by 1 for each minion engaged with you. Active from hand
  // (docs/phase7-wave1.md §3.10, "Cost reductions active from hand").
  "06011.hercules-constant": constant(
    costModifier({
      delta: scaled(countOf(query("minion", { engagedWith: "you" })), { times: -1 }),
      appliesTo: query("ally", { self: true }),
      activeIn: "hand",
    }),
  ),

  // Valkyrie (06012) — Response: After Valkyrie enters play, deal 2 damage to a minion (3 damage instead if you
  // paid for this card using a [energy] resource). Previously skipped: a Response to a card's own entering play saw
  // an empty `vars`/`bindings` ability frame, so `paidWith("energy")` always read false. Fixed 2026-09-15
  // (`packages/engine/src/resolve/frames.ts` `abilityFrame`/`playPaymentVars`): while a card's own `playCard` frame
  // is still on the stack, its Response candidate's ability frame is seeded with that play's `paid.*` vars, so
  // `paidWith("energy")` now reads correctly here (docs/phase7-wave1-scripting.md §6).
  "06012.valkyrie-response": response(
    after.entersPlay("self"),
    chooseTarget("minion", query("minion")),
    dealDamage(ifElse(paidWith("energy"), 3, 2), chosen("minion")),
  ),

  // Get Over Here! — Hero Action (attack): Deal 1 damage to a minion. If you have the Aerial trait, engage that
  // enemy. `EffectSpec.engage` (packages/engine/src/spec.ts, named for this exact card); no `dsl/effects.ts`
  // wrapper yet, so `engage` is a local helper (`local.ts`).
  "06014.get-over-here-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("minion", "minion"),
    attack(1, chosen("minion")),
    ifThen(hasTrait(yourIdentity, TRAIT.AERIAL), engage(chosen("minion"))),
  ),

  // Mean Swing (06015) — Hero Interrupt: When your hero makes a basic attack, exhaust a Weapon upgrade on your hero
  // → your hero gets +3 ATK for this attack. Was skipped for lack of a `TargetQuery` field that names "a card
  // attached to an arbitrary `TargetRef`" (`hostOfSelf` only reads against the ability's own card). Now scripted
  // with `TargetQuery.host` (docs/phase7-wave1-scripting.md §6, landed with the wave B primitives batch):
  // `query("upgrade", { trait: trait("WEAPON"), host: yourIdentity })` reads "a Weapon upgrade on your hero".
  "06015.mean-swing-interrupt": heroInterrupt(
    on.attacks(YOUR_HERO, { basic: true }),
    { cost: exhaustCardsCost(query("upgrade", { trait: trait("WEAPON"), host: yourIdentity })) },
    modifyStat("atk", 3, yourIdentity, "endOfAttack"),
  ),

  // Hall of Heroes — Response: After you defeat a minion, place 1 glory counter here.
  "06017.hall-of-heroes-response": response(after.defeated(query("minion"), { byYou: true }), addCounters("glory", 1)),
  // Hall of Heroes — Alter-Ego Action: Exhaust Hall of Heroes and remove 3 glory counters from it → draw 3 cards.
  "06017.hall-of-heroes-action": alterEgoAction({ cost: [exhaustThis, removeCounter("glory", 3)] }, draw(3)),

  // Battle Fury — Play under any player's control. Max 1 per player (data, `playRestrictions`). Response: After
  // your hero attacks and defeats a minion, deal 1 damage to your hero and discard Battle Fury → ready your hero.
  "06018.battle-fury-response": response(
    after.attacks(YOUR_HERO, { target: query("minion"), defeats: true }),
    dealDamage(1, yourIdentity),
    discard(self),
    ready(yourIdentity),
  ),

  // Jarnbjorn — Restricted (data). Response: After your hero attacks an enemy, spend a [physical] resource → deal
  // 2 damage to an enemy.
  "06019.jarnbjorn-response": response(
    after.attacks(YOUR_HERO, { target: query("enemy") }),
    { cost: spend({ physical: 1 }) },
    damageAnEnemy(2),
  ),

  // Heimdall — Response: After Heimdall enters play, look at the top 3 cards of the encounter deck. Discard 1 of
  // them and put the others back in any order. `EffectSpec.reorderCards` (packages/engine/src/spec.ts, named for
  // this exact card); no `dsl/effects.ts` wrapper yet, so `reorderCards` is a local helper (`local.ts`).
  "06020.heimdall-response": response(
    after.entersPlay("self"),
    selectCards("looked", encounterCards(["deck"], undefined, 3)),
    chooseCards("discarded", cards(chosen("looked")), { min: 1, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
    reorderCards(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
  ),

  // Invulnerability — Hero Action: Give your hero a tough status card.
  "06021.invulnerability-action": heroAction(giveTough(yourIdentity)),

  // Under Surveillance — Attach to the main scheme. Max 1 per scheme (data, `attachesTo`/`playRestrictions`); no
  // effect of its own beyond the attach restriction, already covered by engine rules.
  "06031.under-surveillance-constant": coveredByEngineRule(),
  // Under Surveillance — Increase the target threat value of attached scheme by 4.
  "06031.under-surveillance-constant-2": constant(gets("targetThreat", 4, { hostOfSelf: true })),

  // Teamwork — Hero Interrupt: When you use your basic thwart power (THW) or basic attack power (ATK), exhaust an
  // ally you control → add that ally's matching power to your hero's power for this use. One `EventPattern`
  // matches both `attack` and `thwart` events from your hero with `attackKind: "basic"` (both event kinds carry a
  // `basic` flag, packages/engine/src/trigger-events.ts). Applying both stat bonuses is exact, not an
  // approximation: `until: "endOfAttack"` expires at the end of *this* activation frame regardless of whether it's
  // an attack or a thwart (`currentActivationFrameId`, packages/engine/src/stack.ts), and only the matching power
  // (ATK for an attack, THW for a thwart) is ever read while that frame resolves, so the other bonus is inert.
  "06032.teamwork-constant": heroInterrupt(
    { on: ["attack", "thwart"], sourceIs: YOUR_HERO, attackKind: "basic" },
    { cost: exhaustCardsCost(query("ally", { controller: "you" }), { slot: "ally" }) },
    modifyStat("atk", statOf(chosen("ally"), "atk"), yourIdentity, "endOfAttack"),
    modifyStat("thw", statOf(chosen("ally"), "thw"), yourIdentity, "endOfAttack"),
  ),

  // Second Wind — Action: Heal 4 damage from an identity (5 damage instead if you paid for this card using a
  // [mental] resource).
  "06033.second-wind-action": action(
    chooseTarget("identity", query("identity")),
    heal(ifElse(paidWith("mental"), 5, 4), chosen("identity")),
  ),

  // Enhanced Physique — Uses (3 physical counters) (data). Hero Resource: Exhaust Enhanced Physique and remove 1
  // physical counter from it → generate a [physical] resource.
  "06034.enhanced-physique-resource": heroResource({ physical: 1 }, { cost: [exhaustThis, removeCounter("physical")] }),
});
