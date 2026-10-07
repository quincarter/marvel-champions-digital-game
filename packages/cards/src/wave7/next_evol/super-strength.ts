import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attacksGainKeywords,
  bindTargets,
  cards,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discard,
  each,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  giveTough,
  hasTrait,
  heroAction,
  ifThen,
  moveCards,
  on,
  printedCostOf,
  query,
  reducesAttackDamageTaken,
  self,
  spend,
  superlative,
  surge,
  theVillain,
  valueEquals,
  varOf,
  whenRevealed,
} from "../../dsl/index.js";

/**
 * The Super Strength set (40155-40158); see flight.ts for how it comes into play. Steady is a keyword grant (RRG p. 41);
 * Mister Sinister's Forced Responses hear the status cards it makes the villain take two of.
 */
const BRUTE = trait("BRUTE");
const PSIONIC = trait("PSIONIC");
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });

export const SUPER_STRENGTH: AbilityRegistry = defineAbilities({
  // Super Strength — Attached villain gains the BRUTE trait and steady.
  "40155.super-strength-constant": constant(
    gainsTrait(BRUTE, ATTACHED_VILLAIN),
    gainsKeyword({ name: "steady" }, ATTACHED_VILLAIN),
  ),

  // Impervious — Reduce the amount of damage attached villain takes from each attack by 1.
  "40156.impervious-constant": constant(reducesAttackDamageTaken(ATTACHED_VILLAIN, 1)),
  // Hero Action: Spend [physical][physical] resources -> give the villain a tough status card and discard this card.
  "40156.impervious-action": heroAction({ cost: spend({ physical: 2 }) }, giveTough(theVillain), discard(self)),

  // Thrown Object — [star] Attached villain's attacks gain ranged. [star] Forced Response: After the villain attacks,
  // discard this card. (ATK +3 is the stat box.)
  "40157.thrown-object-constant": constant(attacksGainKeywords(["ranged"], { attacker: { hostOfSelf: true } })),
  "40157.thrown-object-forced-response": forcedResponse(on.villainAttacks(), discard(self)),

  // "I'll Take That" — When Revealed: Discard the upgrade you control with the lowest cost (highest cost instead if the
  // villain has the PSIONIC trait). If no upgrade was discarded this way, this card gains surge. A tie is the revealing
  // player's choice; cost is the printed cost.
  "40158.when-revealed": whenRevealed(
    ifThen(
      hasTrait(theVillain, PSIONIC),
      bindTargets(
        "extreme",
        superlative("highest", each(query("upgrade", { controller: "you" })), printedCostOf(chosen("candidate"))),
      ),
      bindTargets(
        "extreme",
        superlative("lowest", each(query("upgrade", { controller: "you" })), printedCostOf(chosen("candidate"))),
      ),
    ),
    chooseTarget("pick", { inSlot: "extreme" }),
    moveCards(cards(chosen("pick")), "discard", "moved"),
    ifThen(valueEquals(varOf("moved.count"), 0), surge()),
  ),
});
