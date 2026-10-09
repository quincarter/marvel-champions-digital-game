/**
 * Sinister Motives' two basic player cards outside a hero kit: Venom (Eddie Brock, ally 27190) and Symbiote Suit
 * (upgrade 27191). Both are ordinary basic cards in standalone play; only the MC27 campaign prohibits them from decks
 * (MC27 p. 4, `Campaign.prohibited` in `campaigns/sm.ts`), and puts them into play itself on nodes 13/15 and 25.
 */
import {
  anEnemy,
  chosen,
  constant,
  countBoostIcons,
  damageThisCardCost,
  dealDamage,
  defineAbilities,
  eventTarget,
  gets,
  on,
  response,
  sum,
  varOf,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

export const SM_BASIC_CARDS = defineAbilities({
  // Venom (Eddie Brock, ally 27190) — Response: After you reveal an encounter card, deal 1 damage to Venom → deal
  // damage to an enemy equal to the number of icons ([star] and [boost]) in that card's boost area. A star icon is
  // not a boost icon (RRG 1.8 "Boost, Boost Icon", p. 11), so the card names both and both are counted.
  "27190.venom-response": response(
    on.youRevealEncounterCard(),
    { cost: damageThisCardCost(1) },
    anEnemy(),
    countBoostIcons(eventTarget, "revealed"),
    dealDamage(sum(varOf("revealed.boostIcons"), { kind: "starIcons", cards: eventTarget }), chosen("enemy")),
  ),

  // Symbiote Suit (upgrade 27191) — Max 1 per deck (data). Your identity gets +1 to each of its basic powers, +1 hand
  // size, and +10 hit points. REC is an alter-ego basic power (RRG 1.8 "Basic Power", p. 11).
  "27191.symbiote-suit-constant": constant(
    gets("atk", 1, YOUR_IDENTITY),
    gets("thw", 1, YOUR_IDENTITY),
    gets("def", 1, YOUR_IDENTITY),
    gets("rec", 1, YOUR_IDENTITY),
    gets("handSize", 1, YOUR_IDENTITY),
    gets("hp", 10, YOUR_IDENTITY),
  ),
});
