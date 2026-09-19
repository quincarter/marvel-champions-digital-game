import { trait } from "@mc/content";
import {
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
  exists,
  gets,
  giveTough,
  heal,
  heroAction,
  heroResponse,
  ifElse,
  modifyStat,
  moveCards,
  on,
  paidWith,
  query,
  remainingHpOf,
  removeThreat,
  response,
  self,
  valueAtLeast,
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
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `12024.team-building-exercise-action` — "play a card from your hand **that shares a trait with your hero**,
 *   reducing its resource cost by 1" needs the reduced-cost-play primitive `playFromHand.costReduction`
 *   (docs/phase7-wave2.md §9, landed) *and* a `TargetQuery` filter for "shares a trait with a referenced card" —
 *   the second half doesn't exist. `TargetQuery.trait`/`anyTrait` match one fixed trait or a fixed OR of several,
 *   never "whatever traits another specific card currently has" (the printed example in docs/phase7-wave2.md §9.1,
 *   `{ trait: AVENGER }`, is a fixed trait, not this card's dynamic one — Team-Building Exercise itself is a
 *   generic basic-aspect card played by any hero, so "your hero" is not a fixed trait this script can hardcode).
 *   Closest existing primitive: `RuleSpec gainsTraitsOf`'s `traitsOf: TargetQuery` (a *grant* reading another
 *   card's printed traits live), the same shape a `TargetQuery.sharesTraitWith: TargetRef` field would need.
 * - `12032.muster-courage-action` — "give up to X friendly characters a tough status card (to a maximum of 3),
 *   where X is the villain's stage number" needs a dynamic upper bound on a choice; `EffectSpec.chooseCards.max`
 *   is a fixed `number`, not a `ValueSpec` the way `chooseTarget.count`/`discardFromHand.amount` already are.
 * - `12011.ant-man-interrupt` — "place 1 pym counter on him (to a maximum of 4) for each resource you overpaid for
 *   Ant-Man's cost" needs `overpaid.total` (docs/phase7-wave2.md §3.8) readable from a *later* `cardEntersPlay`
 *   interrupt on the same card, not just within the same ability resolution that paid the cost — confirmed by the
 *   validator ("read before it is bound") rather than assumed.
 */
export const ANT_PACK_CARDS = defineAbilities({
  // Ant-Man (12011, ally, Hank Pym) — Ant-Man gets +1 hit point for each pym counter on him.
  "12011.ant-man-constant": constant(gets("hp", countersOn(self, "pym"), query("ally", { self: true }))),
  // Ant-Man — Interrupt: when Ant-Man enters play, place 1 pym counter on him (to a maximum of 4) for each
  // resource overpaid for his cost. SKIPPED (missing primitive — module docblock addendum): `overpaid.total`
  // (docs/phase7-wave2.md §3.8) is a var bound by the *same* ability resolution that pays a cost — the engine's
  // own validator rejects reading it from a later, separate `cardEntersPlay` interrupt on the same card ("read
  // before it is bound"), confirming this isn't yet carried from a play's own payment into a later trigger on the
  // card that play brought into play.

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

  // Muster Courage (12032, Protection) — SKIPPED (missing primitive — module docblock addendum): "give up to X
  // friendly characters a tough status card (to a maximum of 3), where X is the villain's stage number" needs a
  // dynamic upper bound on a choice; `EffectSpec.chooseCards.max` is a fixed `number`, not a `ValueSpec` the way
  // `chooseTarget.count`/`discardFromHand.amount` already are, so "up to X" can't be read live — a flat `max: 3`
  // would wrongly allow 3 choices on villain stage 1 or 2.

  // Assess the Situation (12033, Basic) — Action: you get +1 hand size until the end of the phase.
  "12033.assess-the-situation-action": {
    trigger: { kind: "action" },
    effects: [modifyStat("handSize", 1, yourIdentity, "endOfPhase")],
  },
});
