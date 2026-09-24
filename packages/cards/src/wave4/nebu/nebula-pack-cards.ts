import { trait } from "@mc/content";
import {
  action,
  alterEgoAction,
  attackAnEnemy,
  cancelConsequentialDamage,
  cards,
  centralMainScheme,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  damageThisCardCost,
  defineAbilities,
  discard,
  doublesResourcesWhilePayingFor,
  draw,
  each,
  encounterCards,
  eventPlayer,
  eventTarget,
  exhaustThis,
  exists,
  gainsKeyword,
  gainsTrait,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  interrupt,
  moveCards,
  not,
  on,
  option,
  partOf,
  query,
  ready,
  refMatches,
  removeCounter,
  removeThreat,
  response,
  revealCard,
  rule,
  self,
  shuffleEncounterDeck,
  statOf,
  threatOn,
  topOfDeck,
  valueAtMost,
  valueEquals,
  varOf,
  when,
  you,
  yourIdentity,
  YOUR_HERO,
  zone,
} from "../../dsl/index.js";

const GUARDIAN = trait("GUARDIAN");

/**
 * Nebula's remaining pack cards: Eros (22011, `justice`, errata RRG 1.8 p. 67 — see the card record's own
 * `errata` field), Wraith (22012), Venom (22013), and the rest of the pack's Justice and Basic cards (22014–22026),
 * plus the off-aspect cards (Energy Spear 22032 (Aggression), Guardians of the Galaxy 22033 (Leadership),
 * Defensive Training 22034 (Protection), Honorary Guardian 22035 (Basic)).
 *
 * **Cosmo (22020) and Knowhere (22021) reprint `stld` 17020/17022 verbatim** (same printed text, same card back);
 * `wave4` has no reprint-aliasing module of its own yet (unlike `wave3/reprints.ts`), so they're scripted directly
 * here rather than aliased — see `wave3/stld/star-lord-kit.ts` for the shape this is copied from.
 */
export const NEBULA_PACK_CARDS = defineAbilities({
  // Eros (ally, 22011) — errata (RRG 1.8 p. 67): Response: After you play Eros from your hand, for each [mental]
  // resource you used to pay for him, choose a minion and confuse it. `paid.mental` is the number of [mental]
  // resources (wilds declared as mental included) spent on his cost (`packages/engine/src/actions.ts`); confuse is
  // idempotent (RRG 1.8 "Status Cards", p. 42 — a character either has the confused status or doesn't), so
  // "for each resource, choose a minion" collapses to "choose up to that many minions" with no behavioral gap: if
  // fewer minions exist than resources spent, the errata'd repeated choice can only ever re-confuse one already
  // chosen, which changes nothing.
  "22011.eros-response": response(
    on.youPlayThis(),
    chooseTarget("minions", query("minion"), { count: varOf("paid.mental"), upTo: true }),
    confuse(chosen("minions")),
  ),

  // Wraith (ally, 22012) — Hero Interrupt: When a boost card is turned faceup, exhaust Wraith and deal 1 damage to
  // him → cancel that card's "Boost" effect. `{ kind: "cancelBoostAbility" }`/`{ on: "boostCardTurnedFaceup" }` are
  // the engine's own existing shapes (`packages/engine/src/boost.test.ts`'s "Target Acquired" fixture; `spec.ts`
  // `EffectSpec.cancelBoostAbility`) with no DSL wrapper yet — passed as plain data, contextually typed against
  // `heroInterrupt`'s own `EventPattern`/`EffectSpec` parameters, rather than adding one for this single card.
  "22012.wraith-interrupt": heroInterrupt(
    { on: "boostCardTurnedFaceup" },
    { cost: [exhaustThis, damageThisCardCost(1)] },
    { kind: "cancelBoostAbility" },
  ),

  // Venom (ally, 22013) — While there is no threat on the main scheme, reduce all consequential damage Venom takes
  // by 1. Read as the two consequential-damage stat modifiers (`gets("consequentialAttack"/"consequentialThwart",
  // …)`, `packages/cards/src/dsl/abilities.ts`), not `RuleSpec reduceDamageTaken` (which is for damage dealt *from
  // an attack*, `fromAttack: true` — consequential damage is neither, RRG 1.8 "Consequential Damage", p. 14). "The
  // main scheme" with one main scheme in play reads as the central scheme (docs/phase7-wave4.md §4 Q2 precedent).
  "22013.venom-constant": constant(
    gets("consequentialAttack", -1, query("ally", { self: true }), {
      while: valueAtMost(threatOn(centralMainScheme), 0),
    }),
    gets("consequentialThwart", -1, query("ally", { self: true }), {
      while: valueAtMost(threatOn(centralMainScheme), 0),
    }),
  ),

  // Justice Served (upgrade, 22014) — Play under any player's control. Max 1 per player (data). Hero Response:
  // After you thwart and remove the last threat from a scheme, discard Justice Served → ready your hero. No
  // `EventPattern` result flags "this thwart removed the last threat" directly, so the state fact (the thwarted
  // scheme now carries 0 threat) is checked with `ifThen` inside the response body, over the thwart's own
  // `eventTarget` (the scheme).
  "22014.justice-served-response": heroResponse(
    on.thwarts(YOUR_HERO),
    ifThen(valueEquals(threatOn(eventTarget), 0), [discard(self), ready(yourIdentity)]),
  ),

  // One Way or Another (event, 22015) — Max 1 per round (data). Hero Action: Search the encounter deck for a side
  // scheme. Reveal that side scheme → draw 3 cards (shuffle the encounter deck).
  "22015.one-way-or-another-action": heroAction(
    { limit: { count: 1, period: "round" } },
    chooseCards("found", encounterCards(["deck"], query("sideScheme")), { min: 0, max: 1 }),
    revealCard(chosen("found")),
    draw(3),
    shuffleEncounterDeck(),
  ),

  // Determination (resource, 22016) — Max 1 per deck (data). Hero Response: After you spend this card, remove 1
  // threat from the main scheme.
  "22016.determination-response": heroResponse(on.youSpendThis(), removeThreat(1, centralMainScheme)),

  // The Power of Justice (resource, 22017) — Max 2 per deck (data). Double the number of resources this card
  // generates while paying for a Justice (yellow) card. Reprints Core's own The Power of Justice (01062,
  // `core/aspects/justice.ts`) under a new pack-specific ability id (wave 4 has no reprint-aliasing module yet).
  "22017.the-power-of-justice-constant": constant(doublesResourcesWhilePayingFor({ aspect: "justice" })),

  // Brains Over Brawn (event, 22018) — Hero Response (attack): After your hero makes a basic thwart, deal damage
  // to an enemy equal to your hero's THW.
  "22018.brains-over-brawn-response": heroResponse(
    on.thwarts(YOUR_HERO, { basic: true }),
    { label: "attack" },
    attackAnEnemy(statOf(yourIdentity, "thw")),
  ),

  // Heroic Intuition (upgrade, 22019) — Play under any player's control. Max 1 per player (data). Your hero gets
  // +1 THW. Reprints Core's own Heroic Intuition (01065, `core/aspects/justice.ts`).
  "22019.heroic-intuition-constant": constant(gets("thw", 1, YOUR_HERO)),

  // Cosmo (ally, 22020) — Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of
  // a player deck or the encounter deck. If that card is of the named type, Cosmo does not take consequential
  // damage for this use. Copied verbatim from `stld` 17020 (`wave3/stld/star-lord-kit.ts`) under this pack's own
  // ability id.
  "22020.cosmo-interrupt": interrupt(
    when.attacksOrThwarts("self"),
    chooseOne(
      option(
        "A player's deck",
        choosePlayer("owner"),
        chooseOne(
          ...(["ally", "event", "upgrade", "support", "resource"] as const).map((category) =>
            option(
              category,
              moveCards(topOfDeck(1, chosenPlayer("owner")), "discard", "named"),
              ifThen(refMatches(chosen("named"), query(category), { anywhere: true }), cancelConsequentialDamage()),
            ),
          ),
        ),
      ),
      option(
        "The encounter deck",
        chooseOne(
          ...(["minion", "sideScheme", "attachment", "treachery", "obligation"] as const).map((category) =>
            option(
              category,
              moveCards(encounterCards(["deck"], undefined, 1), "discard", "named"),
              ifThen(refMatches(chosen("named"), query(category), { anywhere: true }), cancelConsequentialDamage()),
            ),
          ),
        ),
      ),
    ),
  ),

  // Knowhere (support, 22021) — Play only if your identity has the guardian trait (data). Increase your ally limit
  // by 1. Response: After a player plays a guardian ally, exhaust Knowhere → that player draws 1 card. Copied
  // verbatim from `stld` 17022 (`wave3/stld/star-lord-kit.ts`).
  "22021.knowhere-constant": constant(rule({ kind: "allyLimit", amount: 1 })),
  "22021.knowhere-response": response(
    on.cardPlayed(query("ally", { trait: GUARDIAN })),
    { cost: exhaustThis },
    draw(1, eventPlayer),
  ),

  // Daughters of Thanos (event, 22022) — Team-Up (Gamora and Nebula) (data, keyword-driven). Max 1 per deck (data).
  // Hero Action: Draw 3 cards.
  "22022.daughters-of-thanos-action": heroAction(draw(3)),

  // First Aid (event, 22023) — Action: Heal 2 damage from any character. Reprints Core's own First Aid (01086,
  // `core/aspects/basic.ts`).
  "22023.first-aid-action": action(chooseTarget("character", query("character")), heal(2, chosen("character"))),

  // Energy Spear (upgrade, 22032, Aggression) — Attach to a guardian ally. Max 1 per ally (data). Attached ally
  // gets +2 ATK and gains piercing.
  "22032.energy-spear-constant": constant(
    gets("atk", 2, { hostOfSelf: true }),
    gainsKeyword({ name: "piercing" }, { hostOfSelf: true }),
  ),

  // Guardians of the Galaxy (support, 22033, Leadership) — Play under any player's control. Max 1 team card per
  // player (data). If each of your characters has the guardian trait, this card gains: "Response: After you play
  // an upgrade on an ally, draw 1 card." No engine `while` gate exists for a response trigger itself (only actions
  // carry one), so the printed condition is checked inside the response body with `ifThen` — functionally
  // identical for what matters here: the response never draws unless the condition holds at the moment it fires.
  "22033.guardians-of-the-galaxy-constant": response(
    on.youPlayedCard(query("upgrade", { host: each(query("ally", { controller: "you" })) })),
    ifThen(not(exists(query("character", { controller: "you", withoutTrait: GUARDIAN }))), draw(1)),
  ),
  "22033.guardians-of-the-galaxy-constant-2": partOf("22033.guardians-of-the-galaxy-constant"),

  // Defensive Training (support, 22034, Protection) — Max 2 per deck. Uses (2 training counters) (data). Alter-Ego
  // Action: Exhaust this card and remove 1 training counter from this → choose a Protection (green) event in your
  // discard pile and shuffle it into your deck.
  "22034.defensive-training-action": alterEgoAction(
    { cost: [exhaustThis, removeCounter("training", 1)] },
    chooseCards("found", zone("discard", you, { filter: query("event", { aspect: "protection" }) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  // Honorary Guardian (upgrade, 22035, Basic) — Play only if your identity has the guardian trait (data). Attach
  // to a friendly character. Max 1 per character (data). Attached character gets +1 hit point and gains the
  // guardian trait.
  "22035.honorary-guardian-constant": constant(
    gets("hp", 1, { hostOfSelf: true }),
    gainsTrait(GUARDIAN, { hostOfSelf: true }),
  ),
});
