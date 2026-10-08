import type { AbilityRegistry, TargetRef } from "@mc/engine";
import {
  action,
  attacksGainKeywords,
  chooseCards,
  chosen,
  constant,
  declareDefender,
  defineAbilities,
  exhaustThis,
  gainsKeyword,
  gets,
  inHand,
  interrupt,
  on,
  playFromHandReducingCost,
  query,
  response,
  self,
  swapCards,
  titled,
  topOfDeck,
  topOfYourDeckHas,
  you,
  zone,
} from "../../../dsl/index.js";

/** "Magik": the identity titled Magik, so only her hero face (the alter-ego is Illyana Rasputin). */
const MAGIK = titled("Magik");

/** "Swap a card in your hand with the top card of your deck": Domino's shape (wave 7 section 3.57). */
const swapHandWithTop = [
  chooseCards("handCard", zone("hand", you), { min: 1, max: 1 }),
  chooseCards("top", topOfDeck(1), { min: 1, max: 1 }),
  swapCards(chosen("handCard") as TargetRef, chosen("top")),
] as const;

/**
 * Magik signature ally, support and upgrades (docs/phase7-wave8.md section 7.1, 3.50, 3.56, 3.60).
 *
 * **Limbo (45032)**: a Response after the villain phase begins (`on.phaseBeginning("villain")`) and an Action, both
 * exhausting Limbo to swap a card of the hand with the top card of the deck (the hand card goes on top of the deck, the
 * deck card enters the hand; neither is drawn or discarded, RRG "Swap", p. 42).
 *
 * **Magik's Crown, Soulsword, Mystical Armor (45033 to 45035)**: each is two constants on the identity titled Magik:
 * the keyword (steady; basic attacks gain piercing; retaliate 1) and a stat modifier (+1 THW, +1 ATK, +1 DEF) whose
 * `while` is `topOfYourDeckHas(type)`, the top card faceup with that printed icon or a wild (section 3.50). Restricted
 * (Soulsword) is card data. A modifier whose `while` reads the deck follows the top card with no ability resolving.
 *
 * **Colossus (45031)**: active in hand; when an enemy attacks you, play him from the hand paying his cost, then declare
 * him the defender without exhausting him. The engine offers an in-hand interrupt that plays its own card only while
 * the card can be played and paid for (RRG 1.8 "Initiating Abilities", p. 24, step 2), so with a hand that cannot pay
 * his 3 it is not offered. Toughness is data.
 *
 * Cards (5):
 * - 45031 Colossus (ally)
 * - 45032 Limbo (support)
 * - 45033 Magik's Crown (upgrade)
 * - 45034 Soulsword (upgrade)
 * - 45035 Mystical Armor (upgrade)
 */
export const MAGIK_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "45031.colossus-interrupt": inHand(
    interrupt(
      on.enemyAttacks({ categories: ["villain", "minion"] }, { againstYou: true }),
      playFromHandReducingCost(0, you, { filter: query("ally", { self: true }) }),
      declareDefender(self, { exhaust: false }),
    ),
  ),

  "45032.limbo-response": response(on.phaseBeginning("villain"), { cost: exhaustThis }, ...swapHandWithTop),
  "45032.limbo-action": action({ cost: exhaustThis }, ...swapHandWithTop),

  "45033.magiks-crown-constant": constant(gainsKeyword({ name: "steady" }, MAGIK)),
  "45033.magiks-crown-constant-2": constant(gets("thw", 1, MAGIK, { while: topOfYourDeckHas("mental") })),

  "45034.soulsword-constant": constant(attacksGainKeywords(["piercing"], { attacker: MAGIK, basicOnly: true })),
  "45034.soulsword-constant-2": constant(gets("atk", 1, MAGIK, { while: topOfYourDeckHas("physical") })),

  "45035.mystical-armor-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, MAGIK)),
  "45035.mystical-armor-constant-2": constant(gets("def", 1, MAGIK, { while: topOfYourDeckHas("energy") })),
});

/** Refs left unregistered, each with its reason. None is left. */
export const MAGIK_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
