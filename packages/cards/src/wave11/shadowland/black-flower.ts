import type { AbilityRegistry } from "@mc/engine";
import { trait } from "@mc/content";
import {
  addCounters,
  adjustBoostCount,
  boost,
  cancelIt,
  chooseOne,
  chooseOneBy,
  defeatingPlayer,
  defineAbilities,
  dealIndirectDamage,
  discardAtRandom,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  forEachPlayer,
  hasTrait,
  ifThen,
  interrupt,
  on,
  option,
  placeThreat,
  self,
  takeDamage,
  theMainScheme,
  theVillain,
  thatPlayer,
  varAtLeast,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";
import {
  CORRUPTION,
  hasCreepingCorruption,
  placeCorruption,
  youHaveCreepingCorruption,
  YOUR_CREEPING_CORRUPTION,
} from "./creeping-corruption.js";

/**
 * Shadowland Black Flower modular set (13 printed copies): the encounter cards beside Creeping Corruption, which has its
 * own module (`creeping-corruption.ts`).
 *
 * "Place N corruption counters on your Creeping Corruption" is `placeCorruption` (as in `heart-of-shadow.ts`). When a
 * player has no Creeping Corruption, the effect has no target and does nothing. This is a defensive path: RRG 1.8
 * "Setup (keyword)" p. 39 and Appendix II step 11 put Setup cards into play in a standalone game too, so a
 * standalone Creeping Corruption (one per player) is a setup item handled elsewhere, not here. An option or optional ability that exists only to place one is not offered (RRG 1.8 "Choose
 * (Option)", p. 12; "Target", p. 42). "If it has the Overpowering trait" then reads false for a missing card, which
 * takes the "otherwise" branch (the most literal reading; nothing in the RRG or MC65 insert says more).
 *
 * **65073 Aka**: Quickstrike and Villainous are data. The Interrupt reads "would attack you": it resolves before other
 *   interrupts to the attack and cancels it only if the counter was placed ("If you do"). Boost: the printed "Choose:
 *   Either ... or ..." is a two-option choice, the discard random.
 * **65074 Tongue of the Beast**: When Defeated, the defeating player places 2. Boost: place 1, or this card gains three
 *   boost icons (`adjustBoostCount`, the count of the activation it is boosting).
 * **65075 Binding Ritual**: each player chooses. RRG 1.8 "Each Player" (p. 17) has the first player decide the order when the
 *   effect does not; `forEachPlayer` runs in player order, an engine reading (`dsl/effects.ts`, `forEachPlayer`) that is
 *   acceptable because the order cannot change this card's outcome: a counter on their own
 *   Creeping Corruption, or 3 threat on this scheme. A player with no Creeping Corruption can only place the threat.
 * **65076 Roots of a Black Flower**: When Defeated, the defeating player places 2. Boost: place 1, or 4 threat on the
 *   main scheme.
 * **65077 Malediction**: Alter-Ego, "you may place 2 ... if you do not, the villain schemes with +2 SCH" is two
 *   options. Hero: the trait check reads your Creeping Corruption; Overpowering schemes with +1 SCH, else it attacks you.
 * **65078 Invasive Thoughts**: the counter is placed first, then the trait is read (the engine runs state checks between
 *   effects, RRG 1.8 "Ability" p. 4, "Uses" p. 46, so a 5th counter flips 72A to 72B, with 0 counters, right after the
 *   placement and before the trait is read: the player then gets the Overpowering branch). Overpowering: 1 threat on the
 *   main scheme; otherwise take 1 damage. Boost: place 1, or take 4 indirect damage.
 *
 * Cards (6):
 * - 65073 Aka (minion)
 * - 65074 Tongue of the Beast (minion)
 * - 65075 Binding Ritual (side scheme)
 * - 65076 Roots of a Black Flower (side scheme, x2)
 * - 65077 Malediction (treachery, x2)
 * - 65078 Invasive Thoughts (treachery, x2)
 */
const PLACE_ONE = "Place 1 corruption counter on your Creeping Corruption";
const placeOneOption = () => option(PLACE_ONE, { when: youHaveCreepingCorruption }, placeCorruption(1));
const OVERPOWERING = trait("OVERPOWERING");
const hasOverpowering = hasTrait(YOUR_CREEPING_CORRUPTION, OVERPOWERING);

export const SHADOWLAND_BLACK_FLOWER: AbilityRegistry = defineAbilities({
  "65073.aka-interrupt": interrupt(
    on.enemyAttacks("self", { againstYou: true }),
    { while: youHaveCreepingCorruption, would: true },
    addCounters(CORRUPTION, 1, YOUR_CREEPING_CORRUPTION, { bind: "placed" }),
    ifThen(varAtLeast("placed.amount", 1), cancelIt()),
  ),
  "65073.boost": boost(chooseOne(placeOneOption(), option("Discard 1 random card from your hand", discardAtRandom(1)))),

  "65074.when-defeated": whenDefeated(forEachPlayer(defeatingPlayer, placeCorruption(2, thatPlayer))),
  "65074.boost": boost(chooseOne(placeOneOption(), option("This card gains 3 boost icons", adjustBoostCount(3)))),

  "65075.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          "Place 1 corruption counter on your Creeping Corruption",
          { when: hasCreepingCorruption(thatPlayer) },
          placeCorruption(1, thatPlayer),
        ),
        option("Place 3 threat here", placeThreat(3, self)),
      ),
    ),
  ),

  "65076.when-defeated": whenDefeated(forEachPlayer(defeatingPlayer, placeCorruption(2, thatPlayer))),
  "65076.boost": boost(
    chooseOne(placeOneOption(), option("Place 4 threat on the main scheme", placeThreat(4, theMainScheme))),
  ),

  "65077.when-revealed-alter-ego": whenRevealedAlterEgo(
    chooseOne(
      option(
        "Place 2 corruption counters on your Creeping Corruption",
        { when: youHaveCreepingCorruption },
        placeCorruption(2),
      ),
      option("Do not: the villain schemes with +2 SCH", enemyScheme(theVillain, { schBonus: 2 })),
    ),
  ),
  "65077.when-revealed-hero": whenRevealedHero(
    ifThen(hasOverpowering, enemyScheme(theVillain, { schBonus: 1 }), enemyAttack(theVillain, { against: you })),
  ),

  "65078.when-revealed": whenRevealed(
    placeCorruption(1),
    ifThen(hasOverpowering, placeThreat(1, theMainScheme), takeDamage(1)),
  ),
  "65078.boost": boost(chooseOne(placeOneOption(), option("Take 4 indirect damage", dealIndirectDamage(you, 4)))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_BLACK_FLOWER_SKIPPED: Readonly<Record<string, string>> = {};
