import { trait } from "@mc/content";
import {
  addCounters,
  attack,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countAmong,
  countersOn,
  dealDamage,
  defineAbilities,
  discardThis,
  doublesResourcesWhilePayingFor,
  draw,
  each,
  eventTarget,
  exhaust,
  forcedInterrupt,
  gets,
  giveTough,
  heroAction,
  heroResponse,
  hasStatus,
  ifElse,
  modifyStat,
  on,
  option,
  paidWith,
  query,
  removeStatus,
  removeThreat,
  response,
  scaled,
  self,
  sum,
  theMainScheme,
  theVillain,
  varOf,
  villainStageNumberOf,
  yourIdentity,
} from "../../dsl/index.js";

const AVENGER = trait("AVENGER");

/**
 * The `wsp` pack's non-hero-specific player cards (docs/phase7-wave1-scripting.md §1's convention): Aggression
 * (13011–13017), Basic (13018, 13019, 13024), Justice (13031), Leadership (13032), Protection (13033), Basic
 * (13034). Verbatim Core reprints (The Power of Aggression 13015, Energy 13021, Genius 13022, Strength 13023,
 * Quincarrier 13025) are aliased by `../reprints.ts`, not scripted here.
 *
 * **Previously skipped, now scripted (docs/phase7-wave2.md §18.3/§23):**
 * - `13012.wasp-interrupt` — "place 1 pym counter on her (to a maximum of 3) for each [energy] resource you
 *   overpaid for Wasp's cost" reads `overpaid.energy` from the `cardEntersPlay` interrupt itself: `abilityFrame`
 *   merges the play's own payment vars into every ability frame for a card still on a `playCard` frame, so a later
 *   interrupt on the same card already sees them, per resource type — the identical shape Ant-Man's own overpay
 *   interrupt (12011, `ant/pack-cards.ts`) is scripted for, `.total` there vs. `.energy` here.
 */
export const WSP_PACK_CARDS = defineAbilities({
  // Thor (Jane Foster) — Response: After you play Thor from your hand, deal 2 damage to the villain (3 damage
  // instead if you paid for this card using a [physical] resource). The `paid.*`/Response-on-a-card's-own-play
  // shape Valkyrie (06012, `wave1/thor/pack-cards.ts`) established.
  "13011.thor-response": response(on.entersPlay("self"), dealDamage(ifElse(paidWith("physical"), 3, 2), theVillain)),

  // Wasp (Janet Van Dyne) — Wasp gets +1 hit point for each pym counter on her (safe: a plain counter-scaled stat
  // modifier, no `while`). Interrupt: when Wasp enters play, place 1 pym counter on her (to a maximum of 3) for
  // each [energy] resource overpaid for her cost (module docblock).
  "13012.wasp-constant": constant(gets("hp", countersOn(self, "pym"), query("ally", { self: true }))),
  "13012.wasp-interrupt": forcedInterrupt(
    on.entersPlay("self"),
    addCounters("pym", scaled(varOf("overpaid.energy"), { max: 3 }), self),
  ),

  // Into the Fray — Hero Action (attack): Deal 6 damage to a minion. For each point of excess damage dealt by this
  // attack, remove 1 threat from the main scheme. Without overkill, "excess damage dealt" is still what overkill would
  // spill: damage taken beyond remaining hit points (RRG 1.8 "Overkill", p. 31; `resolve/event.ts` `excessDamageOf`).
  "13013.into-the-fray-action": heroAction(
    { label: "attack" },
    chooseTarget("minion", query("minion")),
    attack(6, chosen("minion"), { bind: "strike" }),
    removeThreat(varOf("strike.excessDealt"), theMainScheme),
  ),

  // Surprise Attack — Hero Response (attack): After you change form, deal 3 damage to an enemy (4 damage instead
  // if you paid for this card using a [physical] resource).
  "13014.surprise-attack-response": heroResponse(
    on.youChangeForm(),
    chooseTarget("enemy", query("enemy")),
    dealDamage(ifElse(paidWith("physical"), 4, 3), chosen("enemy")),
  ),

  // Boot Camp — Play under any player's control. Max 1 per player (data, `playRestrictions`). Each ally you
  // control gets +1 ATK.
  "13016.boot-camp-constant": constant(gets("atk", 1, query("ally", { controller: "you" }))),

  // Lie in Wait — Max 1 per player (data). Hero Response (attack): After a minion engages you, discard Lie in
  // Wait → deal 3 damage to that minion. `{ on: "minionEngaged", playerIs: "controller" }` is the landed primitive
  // for "after you engage a minion" (`wave1/thor/kit.ts`'s own "Have at Thee" comment); `eventTarget` is the
  // engaging minion (`minionEngaged`'s own event carries the same instance as both source and target).
  "13017.lie-in-wait-response": heroResponse(
    { on: "minionEngaged", playerIs: "controller" },
    { label: "attack", cost: discardThis },
    dealDamage(3, eventTarget),
  ),

  // Ironheart — Response: After you play Ironheart from your hand, draw 1 card.
  "13018.ironheart-response": response(on.entersPlay("self"), draw(1)),

  // Spider-Man (Miles Morales) — Response: After you play Spider-Man from your hand, choose THW or ATK. Spider-Man
  // gets +2 to the chosen power until the end of the phase.
  "13019.spider-man-response": response(
    on.entersPlay("self"),
    chooseOne(
      option("THW", modifyStat("thw", 2, self, "endOfPhase")),
      option("ATK", modifyStat("atk", 2, self, "endOfPhase")),
    ),
  ),

  // The Power in All of Us — Max 2 per deck (data). Double the number of resources this card generates when
  // paying for a Basic (gray) card.
  "13024.the-power-in-all-of-us-constant": constant(doublesResourcesWhilePayingFor({ aspect: "basic" })),

  // Running Interference — Play only if your identity has the Avenger trait (data). Hero Action (thwart): Remove
  // 2 threat from the main scheme. Remove X additional threat (to a maximum of 3), where X is the villain's stage
  // number.
  "13031.running-interference-action": heroAction(
    { label: "thwart" },
    removeThreat(sum(2, scaled(villainStageNumberOf(), { max: 3 })), theMainScheme),
  ),

  // All for One — Hero Action (attack): Deal 3 damage to an enemy and exhaust any number of Avenger characters you
  // control. Deal 1 additional damage to that enemy for each character exhausted this way. "Any number" reads as
  // "chooseCards.max wide enough that the engine's own `Math.min(effect.max, candidates.length)` (`resolve/
  // effects-frame.ts`) never binds" — unlike Muster Courage's own capped-by-a-live-value case (`ant/pack-cards.ts`
  // §skip), 20 Avenger characters in one player's play area never happens in a real game, so this isn't an
  // approximation of a different number, just a generous fixed one.
  "13032.all-for-one-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    chooseCards("exhausted", cards(each(query("character", { trait: AVENGER, controller: "you" }))), {
      min: 0,
      max: 20,
    }),
    exhaust(chosen("exhausted")),
    dealDamage(sum(3, countAmong(chosen("exhausted"), {})), chosen("enemy")),
  ),

  // Perseverance — Hero Response: After you change form, give your hero a tough status card.
  "13033.perseverance-response": heroResponse(on.youChangeForm(), giveTough(yourIdentity)),

  // Athletic Conditioning — Hero Action: Discard 1 stun or confuse status card from your hero.
  "13034.athletic-conditioning-action": heroAction(
    chooseOne(
      option(
        "Discard the stunned status",
        { when: hasStatus(yourIdentity, "stunned") },
        removeStatus(yourIdentity, "stunned"),
      ),
      option(
        "Discard the confused status",
        { when: hasStatus(yourIdentity, "confused") },
        removeStatus(yourIdentity, "confused"),
      ),
    ),
  ),
});
