import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  countersOn,
  defineAbilities,
  discard,
  exhaust,
  exists,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  ifThen,
  modifyAttack,
  moveCards,
  on,
  option,
  placeThreat,
  printedCostAtLeast,
  product,
  query,
  selectCards,
  self,
  stun,
  surge,
  takeDamage,
  totalPrintedResources,
  valueAtLeast,
  valueEquals,
  whenRevealed,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * The Mutant Insurrection modular set (40185-40189). Assault on the scheme is a keyword (data, RRG 1.8 p. 8). "[type]
 * resources in your hand" counts printed resource icons of that type: a wild icon is not an energy, mental or physical
 * resource outside generating one for a cost (RRG 1.8 "Wild Resource", p. 48; ruling Jan 17, 2026 (4)).
 */
const MLF = trait("MUTANT LIBERATION FRONT");
const HAND = () => selectCards("hand", zone("hand", you));
const inHand = (type: "energy" | "mental" | "physical") => totalPrintedResources(chosen("hand"), [type]);
/** "A card you control": an ally, support or upgrade in play (a player side scheme prints no cost). */
const CARD_YOU_CONTROL = (minCost: Parameters<typeof printedCostAtLeast>[0]) =>
  query(["ally", "support", "upgrade"], { controller: "you", ...printedCostAtLeast(minCost) });

export const MUTANT_INSURRECTION: AbilityRegistry = defineAbilities({
  // Dragoness — [star] Forced Interrupt: When Dragoness activates against you, she gets +X SCH and +X ATK for that
  // activation, where X is the number of [energy] resources in your hand. Only the bonus of the activation she makes
  // applies: her attack takes +X ATK, her scheme +X SCH.
  "40185.dragoness-forced-interrupt": forcedInterrupt(
    on.enemyActivates("self", { againstYou: true }),
    HAND(),
    modifyAttack({ atkBonus: inHand("energy"), threatBonus: inHand("energy") }),
  ),

  // Forearm — [star] Forced Response: After Forearm attacks you, discard X cards from the top of your deck, where X is
  // the number of [physical] resources in your hand.
  "40186.forearm-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    HAND(),
    selectCards("milled", zone("deck", you, { top: inHand("physical") })),
    moveCards(cards(chosen("milled")), "discard"),
  ),

  // Reaper — [star] Forced Interrupt: When Reaper attacks you, if you have at least [mental][mental] resources in your
  // hand, stun your identity; at least four, exhaust your identity (both bullets apply to a hand of four).
  "40187.reaper-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    HAND(),
    ifThen(valueAtLeast(inHand("mental"), 2), stun(yourIdentity)),
    ifThen(valueAtLeast(inHand("mental"), 4), exhaust(yourIdentity)),
  ),

  // Samurai — [star] Forced Response: After Samurai attacks you, place 1 charge counter here. Choose: take damage equal
  // to the number of charge counters on Samurai, or discard 1 card you control with printed cost equal to or greater
  // than the number of charge counters on Samurai.
  "40188.samurai-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    addCounters("charge", 1, self),
    chooseOne(
      option("Take damage equal to the charge counters", takeDamage(countersOn(self, "charge"))),
      option(
        "Discard a card you control with printed cost at least the charge counters",
        { when: exists(CARD_YOU_CONTROL(countersOn(self, "charge"))) },
        chooseTarget("pay", CARD_YOU_CONTROL(countersOn(self, "charge"))),
        discard(chosen("pay")),
      ),
    ),
  ),

  // Mutant Insurrection — Each minion gains toughness.
  "40189.mutant-insurrection-constant": constant(gainsKeyword({ name: "toughness" }, query("minion"))),
  // When Revealed: Place 2 additional threat here for each MUTANT LIBERATION FRONT character in play. If no additional
  // threat was placed this way, this card gains surge.
  "40189.when-revealed": whenRevealed(
    ifThen(
      valueEquals(countOf(query("character", { trait: MLF })), 0),
      surge(),
      placeThreat(product(2, countOf(query("character", { trait: MLF }))), self),
    ),
  ),
});
