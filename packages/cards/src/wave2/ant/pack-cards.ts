import { trait } from "@mc/content";
import {
  addCounters,
  aScheme,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  dealDamage,
  defineAbilities,
  discardDeckUntil,
  each,
  eventResult,
  exhaustThis,
  exists,
  forcedInterrupt,
  gets,
  giveTough,
  heal,
  heroAction,
  heroResponse,
  identityOf,
  ifElse,
  modifyStat,
  moveCards,
  on,
  paidWith,
  playFromHandReducingCost,
  query,
  remainingHpOf,
  removeThreat,
  response,
  scaled,
  self,
  sharesTraitWith,
  valueAtLeast,
  varOf,
  villainStageNumberOf,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { excludedFromAllyLimit } from "../../dsl/abilities.js";

const AVENGER = trait("AVENGER");

/**
 * The `ant` pack's non-hero-specific player cards (docs/phase7-wave1-scripting.md §1's convention): Leadership
 * (12011–12018), Basic (12024, 12033), Aggression (12030), Justice (12031), Protection (12032). Verbatim Core
 * reprints (First Aid 12019, Energy 12021, Genius 12022, Strength 12023) are aliased by `../reprints.ts`, not
 * scripted here.
 *
 * **Previously skipped, now scripted (docs/phase7-wave2.md §18/§23):**
 * - `12024.team-building-exercise-action` — "play a card from your hand **that shares a trait with your hero**,
 *   reducing its resource cost by 1" is `playFromHandReducingCost` (§9, landed) with a `filter` built from
 *   `TargetQuery.sharesTraitWith` (§20.1, new) — `dsl/values.ts`'s `sharesTraitWith(ref)` wraps it. Both sides are
 *   read live through `traitsOf`, so a granted trait counts on either end (RRG 1.8 "Gains", p. 21).
 * - `12032.muster-courage-action` — "give up to X friendly characters a tough status card (to a maximum of 3),
 *   where X is the villain's stage number" is `chooseTarget`'s `count: ValueSpec` (`scaled(villainStageNumberOf(),
 *   { max: 3 })`) plus `optional: true` for "up to" — not `chooseCards.max` (the *out-of-play* selector), which
 *   the original skip named. docs/phase7-wave2.md §18.5.
 * - `12011.ant-man-interrupt` — "place 1 pym counter on him (to a maximum of 4) for each resource you overpaid for
 *   Ant-Man's cost" reads `overpaid.total` from the `cardEntersPlay` interrupt itself: `abilityFrame` merges the
 *   play's own payment vars into every ability frame for a card still on a `playCard` frame, so a later interrupt
 *   on the same card already sees them — the skip's claim that this needed a new primitive didn't hold up under
 *   a real command sequence. docs/phase7-wave2.md §18.3.
 */
export const ANT_PACK_CARDS = defineAbilities({
  // Ant-Man (12011, ally, Hank Pym) — Ant-Man gets +1 hit point for each pym counter on him.
  "12011.ant-man-constant": constant(gets("hp", countersOn(self, "pym"), query("ally", { self: true }))),
  // Ant-Man — Interrupt: when Ant-Man enters play, place 1 pym counter on him (to a maximum of 4) for each
  // resource overpaid for his cost (docs/phase7-wave2.md §18.3, module docblock).
  "12011.ant-man-interrupt": forcedInterrupt(on.entersPlay("self"), addCounters("pym", scaled(varOf("overpaid.total"), { max: 4 }), self)),

  // Giant-Man (12012) — Giant-Man gets +2 ATK while he has 3 or more remaining hit points.
  "12012.giant-man-constant": constant(gets("atk", 2, query("ally", { self: true }), { while: valueAtLeast(remainingHpOf(self), 3) })),

  // Ronin (12013) — Ronin gets +1 THW and +1 ATK while an upgrade is attached to them.
  "12013.ronin-constant": constant(
    gets("thw", 1, query("ally", { self: true }), { while: exists(query("upgrade", { host: self })) }),
    gets("atk", 1, query("ally", { self: true }), { while: exists(query("upgrade", { host: self })) }),
  ),

  // Stinger (12014) — Play only if your identity has the Avenger trait (data). Stinger does not count against
  // your ally limit.
  "12014.stinger-constant": constant(excludedFromAllyLimit(query("ally", { self: true }))),

  // Call for Aid (12015) — Hero Action: discard cards from the top of your deck until you discard an Avenger
  // ally, then add that ally to your hand.
  "12015.call-for-aid-action": heroAction(discardDeckUntil(query("ally", { trait: AVENGER }), "found"), moveCards(cards(chosen("found")), "hand")),

  // Moxie (12016) — Hero Response: after you change form, your hero gets +1 THW, +1 ATK, +1 DEF until the end of
  // the round.
  "12016.moxie-response": heroResponse(
    on.youChangeForm(),
    modifyStat("thw", 1, yourIdentity, "endOfRound"),
    modifyStat("atk", 1, yourIdentity, "endOfRound"),
    modifyStat("def", 1, yourIdentity, "endOfRound"),
  ),

  // Power Gloves (12017) — Attach to an Avenger ally, max 1 per ally (data). Response: after attached ally attacks
  // or thwarts, deal 1 damage to an enemy.
  "12017.power-gloves-response": response(
    { on: ["attack", "thwart"], sourceIs: { hostOfSelf: true } },
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
  ),

  // Reinforced Suit (12018) — Attach to an ally, max 1 per ally (data). Attached ally gets +2 hit points.
  "12018.reinforced-suit-constant": constant(gets("hp", 2, query("ally", { hostOfSelf: true }))),

  // Moment of Triumph (12030, Aggression) — Hero Response: after you attack and defeat an enemy, heal 1 damage
  // from your hero for each point of excess damage dealt to that enemy by that attack. `excessDealt` is the same
  // var overkill's own spillover reads (`resolve/event.ts`), reported on the attack's own event results.
  "12030.moment-of-triumph-response": heroResponse(on.attacks("self", { defeats: true }), heal(eventResult("excessDealt"), yourIdentity)),

  // Lay Down the Law (12031, Justice) — Hero Response (thwart): after you change form, remove 3 threat from a
  // scheme (4 instead if you paid for this card using a [mental] resource).
  "12031.lay-down-the-law-response": heroResponse(
    on.youChangeForm(),
    { label: "thwart" },
    aScheme(),
    removeThreat(ifElse(paidWith("mental"), 4, 3), chosen("scheme")),
  ),

  // Muster Courage (12032, Protection) — Hero Action: give up to X friendly characters a tough status card (to a
  // maximum of 3), where X is the villain's stage number. Not `EffectSpec.chooseCards` (the *out-of-play* selector
  // — "search your deck", "look at the top 3") — a choice among characters already in play is `chooseTarget`,
  // whose `count` has been `Amount` (a plain number or a live `ValueSpec`) since Shield Toss, and whose
  // `optional: true` is exactly "up to" (RRG 1.8 "Choose (Game Element)", p. 12: an effect resolves as much as it
  // can). docs/phase7-wave2.md §18.5.
  "12032.muster-courage-action": heroAction(
    chooseTarget("brave", query(["hero", "ally"], { controller: "any" }), { optional: true, count: scaled(villainStageNumberOf(), { max: 3 }) }),
    giveTough(chosen("brave")),
  ),

  // Team-Building Exercise (12024, Basic) — Hero Action: Exhaust Team-Building Exercise → play a card from your
  // hand that shares a trait with your hero, reducing its resource cost by 1. `playFromHandReducingCost` (§9) with
  // a `sharesTraitWith(identityOf(you))` filter (§20.1, `dsl/values.ts`) reads "your hero" live rather than as a
  // hardcoded trait — this is a generic basic-aspect card, playable by any hero. docs/phase7-wave2.md §23.
  "12024.team-building-exercise-action": heroAction(
    { cost: exhaustThis },
    playFromHandReducingCost(1, you, { filter: sharesTraitWith(identityOf(you)) }),
  ),

  // Assess the Situation (12033, Basic) — Action: you get +1 hand size until the end of the phase.
  "12033.assess-the-situation-action": {
    trigger: { kind: "action" },
    effects: [modifyStat("handSize", 1, yourIdentity, "endOfPhase")],
  },
});
