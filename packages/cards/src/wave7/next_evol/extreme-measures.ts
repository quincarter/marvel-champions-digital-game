import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  bindTargets,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  each,
  engagedPlayerOf,
  enemyAttack,
  eventTarget,
  forcedResponse,
  gets,
  handCountOf,
  moveCards,
  on,
  option,
  printedCostOf,
  product,
  query,
  reducesAttackDamageTaken,
  selectCards,
  self,
  stun,
  superlative,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * The Extreme Measures modular set (40180-40184). Patrol on Strobe and hinder on the scheme are keywords (data).
 * "A character you control" is the player's identity and each ally they control; Hope Summers (Stryfe's scenario)
 * is an ally in the first player's play area.
 */
const TINY = trait("TINY");
const YOUR_CHARACTERS = query(["identity", "ally"], { controller: "you" });
/** The highest printed-cost card of a category the revealing player controls (a tie is their choice). */
const highestCost = (category: "upgrade" | "support") =>
  bindTargets(
    "extreme",
    superlative("highest", each(query(category, { controller: "you" })), printedCostOf(chosen("candidate"))),
  );

export const EXTREME_MEASURES: AbilityRegistry = defineAbilities({
  // Strobe — When Revealed: Choose: stun each character you control, or deal 1 damage to each character you control.
  "40180.when-revealed": whenRevealed(
    chooseOne(
      option("Stun each character you control", stun(each(YOUR_CHARACTERS))),
      option("Deal 1 damage to each character you control", dealDamage(1, each(YOUR_CHARACTERS), { perTarget: true })),
    ),
  ),

  // Tempo — While Tempo is engaged with you, you get +1 hand size.
  "40181.tempo-constant": constant(gets("handSize", 1, query("identity", { controlledBy: engagedPlayerOf(self) }))),
  // [star] Forced Response: After Tempo activates against you, discard cards from the top of your deck equal to twice
  // the number of cards in your hand.
  "40181.tempo-forced-response": forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    selectCards("milled", zone("deck", you, { top: product(2, handCountOf(you)) })),
    moveCards(cards(chosen("milled")), "discard"),
  ),

  // Thumbelina — Reduce the amount of damage Thumbelina takes from each attack by 1 unless the attacker has the TINY
  // trait.
  "40182.thumbelina-constant": constant(
    reducesAttackDamageTaken({ self: true }, 1, { exceptAttacker: { trait: TINY } }),
  ),
  // When Revealed: Return the highest-cost upgrade you control to its owner's hand (a tie is your choice; printed cost).
  "40182.when-revealed": whenRevealed(
    highestCost("upgrade"),
    chooseTarget("pick", { inSlot: "extreme" }),
    moveCards(cards(chosen("pick")), "hand"),
  ),

  // Wildside — When Revealed: Choose: Wildside attacks you, or return the highest-cost support you control to its
  // owner's hand.
  "40183.when-revealed": whenRevealed(
    chooseOne(
      option("Wildside attacks you", enemyAttack(self, { against: you })),
      option(
        "Return the highest-cost support you control to its owner's hand",
        highestCost("support"),
        chooseTarget("pick", { inSlot: "extreme" }),
        moveCards(cards(chosen("pick")), "hand"),
      ),
    ),
  ),

  // Extreme Measures — Forced Response: After a player card enters play, its controller takes indirect damage equal to
  // that card's printed cost (a player side scheme prints no cost, so it is 0 and is not listed).
  "40184.extreme-measures-forced-response": forcedResponse(
    on.entersPlay(query(["ally", "support", "upgrade"])),
    dealIndirectDamage(controllerOf(eventTarget), printedCostOf(eventTarget)),
  ),
});
