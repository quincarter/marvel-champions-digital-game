import { trait } from "@mc/content";
import {
  action,
  addCounters,
  alterEgoAction,
  anAttackableEnemy,
  aScheme,
  attack,
  cards,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  damageOn,
  defineAbilities,
  draw,
  eventAmount,
  exhaustThis,
  forcedInterrupt,
  FRIENDLY_CHARACTER,
  gainsKeyword,
  giveTough,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifElse,
  ifThen,
  interrupt,
  min,
  modifyAttack,
  modifyStat,
  moveCards,
  on,
  preventDamage,
  query,
  reduceNextCardCost,
  remainingHpOf,
  removeCounter,
  removeCountersFrom,
  removeThreat,
  removeUpToCounters,
  ready,
  self,
  theMainScheme,
  theVillain,
  thwart,
  valueEquals,
  varAtLeast,
  varOf,
  when,
  you,
  YOUR_HERO,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

const GROWTH = "growth";
/** "Groot" as a `countersOn`/`gets` target: his identity, whichever form it's in. */
const GROOT = yourIdentity;
/** "That damage" / "the number of growth counters on Groot", capped to what's actually there — computed once and
 * read identically by every effect that needs it, before any of them removes the counters it measures. */
const DAMAGE_PREVENTABLE = min(eventAmount, countersOn(GROOT, GROWTH));

/**
 * Groot (16001a/b) and his hero kit (16002–16024). Reprints in this pack (Desperate Defense 16013, The Power of
 * Protection 16015, and any others `../reprints.ts` catches by exact name/type match against the earlier pool)
 * are aliased automatically, not scripted here.
 *
 * Three refs recorded in an earlier scripting pass as primitive gaps are now closed (docs/phase7-wave3.md
 * §3.28–§3.29, §3.32; docs/phase7-wave3-scripting.md §6d):
 * - `16006.we-are-groot-action`: `AbilityCost.spendCounters.upTo`/`bind` and `costSelection.counters` (§3.32).
 * - `16009.lashing-vines-response`: `on.basicPowerUsed` already covers a basic attack, thwart and defense with one
 *   subject role (§3.28); a defense's "after" window was also fixed to wait for the attack to end.
 * - `16024.deft-focus-action`: `reduceNextCardCost`'s existing `duration: "turn"` (§3.29).
 */
export const GROOT_KIT = defineAbilities({
  // Flora Colossus — Forced Interrupt: When Groot would take any amount of damage, remove that many growth
  // counters from him. For each growth counter removed this way, prevent 1 of that damage. Both effects read
  // `DAMAGE_PREVENTABLE` before either changes the state it depends on (dsl/values.ts's `min` docblock).
  "16001a.flora-colossus": forcedInterrupt(
    on.damage("self"),
    preventDamage(DAMAGE_PREVENTABLE),
    removeCountersFrom(GROOT, GROWTH, DAMAGE_PREVENTABLE),
  ),

  // Growth Spurt — Action: Place 2 growth counters on Groot (to a maximum of 10). (Limit once per round.) Plain
  // `action`, not `alterEgoAction`: the ability is printed on Groot's own alter-ego face, so it's reachable only
  // in that form already (the identity's `alterEgo.abilities` list), the same shape as Hawkeye's "Weapon of
  // Choice" (`trors` 04001b).
  "16001b.growth-spurt": action({ limit: { count: 1, period: "round" } }, addCounters(GROWTH, 2, GROOT, { upTo: 10 })),

  // Fruition — Action: Place 2 growth counters on Groot (to a maximum of 10).
  "16002.fruition-action": heroAction(addCounters(GROWTH, 2, GROOT, { upTo: 10 })),

  // "I am Groot" — Hero Action (thwart): Remove threat from a scheme equal to the number of growth counters on Groot.
  "16003.i-am-groot-action": heroAction(
    { label: "thwart" },
    aScheme(),
    thwart(countersOn(GROOT, GROWTH), chosen("scheme")),
  ),

  // "I. AM. GROOT!" — Hero Action (attack): Deal damage to an enemy equal to the number of growth counters on Groot.
  "16004.i-am-groot-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(countersOn(GROOT, GROWTH), chosen("enemy")),
  ),

  // Root Stomp — Hero Action (attack): Deal 5 damage to an enemy. If this attack defeats that enemy, place 1
  // growth counter on Groot (to a maximum of 10). `attack`'s `bind` reports `<bind>.defeated` (Stealth Strike,
  // `bkw` 08013, is the same shape).
  "16005.root-stomp-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(5, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), addCounters(GROWTH, 1, GROOT, { upTo: 10 })),
  ),

  // "We Are Groot" — Hero Action: Remove up to 4 growth counters from Groot → choose that many friendly
  // characters. Give each of those characters a tough status card.
  "16006.we-are-groot-action": heroAction(
    { cost: removeUpToCounters(GROWTH, 4, { bind: "removed", fromIdentity: true }) },
    chooseTarget("friends", FRIENDLY_CHARACTER, { count: varOf("removed") }),
    giveTough(chosen("friends")),
  ),

  // Fertile Ground — Alter-Ego Action: Exhaust Fertile Ground → place 1 growth counter on Groot (to a maximum of
  // 10) and draw 1 card.
  "16007.fertile-ground-action": alterEgoAction(
    { cost: exhaustThis },
    addCounters(GROWTH, 1, GROOT, { upTo: 10 }),
    draw(1),
  ),

  // Entangling Vines — Hero Interrupt: When Groot makes a basic thwart, remove 1 growth counter from him and
  // exhaust Entangling Vines → Groot gets +2 THW for that thwart.
  "16008.entangling-vines-interrupt": heroInterrupt(
    when.thwarts(YOUR_HERO, { basic: true }),
    { cost: [removeCounter(GROWTH, 1, { fromIdentity: true }), exhaustThis] },
    modifyStat("thw", 2, GROOT, "endOfAttack"),
  ),

  // Lashing Vines — Hero Response: After Groot uses a basic power, remove 2 growth counters from him and exhaust
  // Lashing Vines → ready Groot. `on.basicPowerUsed` covers a basic attack, thwart and defense (RRG 1.8 "Basic
  // Power"); a basic recovery never reaches this ability, since it's an alter-ego power and this is a Hero
  // Response, so the form gate refuses it (§3.28).
  "16009.lashing-vines-response": heroResponse(
    on.basicPowerUsed(YOUR_IDENTITY),
    { cost: [removeCounter(GROWTH, 2, { fromIdentity: true }), exhaustThis] },
    ready(GROOT),
  ),

  // Vine Shield — Hero Interrupt: When Groot defends against an attack, remove 1 growth counter from him and
  // exhaust Vine Shield → Groot gets +3 DEF for that attack. Same shape as Expert Defense (`cap` 03033).
  "16010.vine-shield-interrupt": heroInterrupt(
    when.defends(YOUR_HERO),
    { label: "defense", cost: [removeCounter(GROWTH, 1, { fromIdentity: true }), exhaustThis] },
    modifyStat("def", 3, GROOT, "endOfAttack"),
  ),

  // Vine Spikes — Hero Interrupt: When Groot makes a basic attack, remove 1 growth counter from him and exhaust
  // Vine Spikes → Groot gets +2 ATK for that attack.
  "16011.vine-spikes-interrupt": heroInterrupt(
    when.attacks(YOUR_HERO, { basic: true }),
    { cost: [removeCounter(GROWTH, 1, { fromIdentity: true }), exhaustThis] },
    modifyStat("atk", 2, GROOT, "endOfAttack"),
  ),

  // Starhawk — Interrupt: When Starhawk takes damage exactly equal to his remaining hit points, return him to
  // your hand. "Exactly equal" is checked before the damage lands (the interrupt window), against Starhawk's own
  // then-current remaining hit points.
  "16012.starhawk-interrupt": interrupt(
    on.damage("self"),
    ifThen(valueEquals(eventAmount, remainingHpOf(self)), moveCards(cards(self), "hand")),
  ),

  // Desperate Defense (16013) reprints Core/wave 1's own Desperate Defense (`drs` 09015) verbatim — aliased by
  // `../reprints.ts`, not scripted here.

  // Fighting Fit — Hero Action (attack): Deal 2 damage to the villain (5 damage instead if your hero's remaining
  // hit points are equal to or greater than your hero's starting hit points). "Remaining >= starting" is exactly
  // "undamaged": remainingHp = maxHp - damage, so the comparison holds iff damage is 0.
  "16014.fighting-fit-action": heroAction(
    { label: "attack" },
    attack(ifElse(valueEquals(damageOn(GROOT), 0), 5, 2), theVillain),
  ),

  // The Power of Protection (16015) reprints Core's own 01079 verbatim — aliased by `../reprints.ts`.

  // Dauntless — Play under any player's control. Max 1 per player (data). While your hero's remaining hit points
  // are equal to or greater than your hero's starting hit points, your hero gains retaliate 1. Same "undamaged"
  // reading as Fighting Fit above.
  "16016.dauntless-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_HERO, { while: valueEquals(damageOn(GROOT), 0) }),
  ),

  // Hard to Ignore — Hero Response: After your hero defends against an attack and takes no damage, exhaust Hard
  // to Ignore → remove 1 threat from the main scheme. Same trigger shape as Unflappable (`drs` 09020); the
  // removal is plain ("remove N threat"), not "(thwart)"-labeled, so it's `removeThreat`, not `thwart`.
  "16017.hard-to-ignore-response": heroResponse(
    when.defends(YOUR_HERO, { takingNoDamage: true }),
    { label: "defense", cost: exhaustThis },
    removeThreat(1, theMainScheme),
  ),

  // Indomitable (16018) reprints an earlier "Response: After your hero defends, discard Indomitable → ready your
  // hero" card verbatim — aliased by `../reprints.ts`, not scripted here.

  // Rocket Raccoon (16019, the ally) — Play only if your identity has the guardian trait (data,
  // `playRestrictions`). Interrupt: When Rocket Raccoon attacks a minion, he gets +3 ATK for that attack. That
  // attack gains overkill.
  "16019.rocket-raccoon-interrupt": interrupt(
    when.attacks("self", { target: query("minion") }),
    modifyStat("atk", 3, self, "endOfAttack"),
    modifyAttack({ overkill: true }),
  ),

  // Deft Focus — Hero Action: Exhaust Deft Focus → reduce the resource cost of the next superpower card you play
  // this turn by 1. "A superpower card" is any card type with the trait, so the filter has no `categories` (§3.29).
  "16024.deft-focus-action": heroAction(
    { cost: exhaustThis },
    reduceNextCardCost(you, 1, "turn", { trait: trait("SUPERPOWER") }),
  ),
});
