import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  attachCard,
  attacksGainKeywords,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  each,
  encounterCards,
  eventAmount,
  exhaust,
  exists,
  flipCard,
  forcedInterrupt,
  forEachPlayer,
  eachPlayer,
  gainsKeyword,
  ifElse,
  ifThen,
  placeThreat,
  inMode,
  on,
  option,
  perHero,
  query,
  removeThreat,
  repeatTimes,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spendResources,
  stateCheckFromEntering,
  theMainScheme,
  theVillain,
  threatOn,
  thatPlayer,
  valueAtLeast,
  valueEquals,
  whenRevealed,
  instead,
  you,
} from "../../../dsl/index.js";

const OUT_FRONT = query("attachment", { name: "Out Front" });
/** The other face of Out Front; a flipped card is its other face's name (RRG 1.8 "Flip", p. 20). */
const ALONGSIDE = query("attachment", { name: "Alongside" });
const SPEEDS = countersOn(theMainScheme, "speed");
const speedAtLeast = (n: number) => valueAtLeast(SPEEDS, n);

/**
 * The Getaway scenario (docs/phase7-wave11-scenarios.md section S6; MC60 p. 19).
 *
 * **60128a/b The Getaway**: Setup puts 1 speed counter on the main scheme (2 in expert) and attaches Out Front, found
 * in the encounter deck, to the villain (the deck is shuffled after the search, RRG 1.8 "Search", p. 39). Acceleration
 * 2 per hero, the 2/9 per hero threat and "if this stage is completed, the players lose" are data. The Forced
 * Interrupt "when the round ends, if there is threat here" is the main scheme's `while`; it places 1 speed counter,
 * then flips Alongside to Out Front (a flip, no reveal) or, with no Alongside in play, places 1 more. The two numbered
 * lines of that one ability parse as the stage's two constants, which are therefore empty (`constant()`).
 * **60129a/b Out Front / Alongside**: the "if there is no threat on the main scheme, flip this card" line is a standing
 * condition (`stateCheckFromEntering`), and the flip is a reveal so Alongside's When Revealed resolves (MC60 p. 19:
 * "This triggers the When Revealed effect on Alongside"). "[star] Attached villain's attacks gain ranged" is an attack
 * keyword grant to the villain. The Forced Interrupt is a "would be dealt" interrupt (before a tough status card, which
 * the villain keeps, RRG 1.8 "Damage", p. 14; MC60 p. 19), replacing the damage with the same amount of threat removed
 * from the main scheme, ignoring crisis icons as printed. It does not resolve while Jackknifed Tanker Truck is in play:
 * no damage is dealt, so there is nothing for it to replace (docs/phase7-wave11-scenarios.md section S3.5).
 * Alongside: each player takes 1 indirect damage and the villain takes 2 per hero damage.
 * **60130 Escort Vehicle**: Guard and Patrol are data; it gains toughness at 3 speed counters, quickstrike at 6, surge
 * at 9 ("also": the grants stack).
 * **60131 Jackknifed Tanker Truck**: Hinder 1 per hero and the crisis icon are data; "the villain cannot be dealt
 * damage" is `cannotTakeDamage` at the `dealt` stage, so no "would be dealt" or "would take" interrupt sees the damage.
 * **60132 Burning Rubber / 60133 Pedestrians**: once for each speed counter on the main scheme, the revealing player
 * chooses one of two options ("choose" with no one named is the revealing player's; each pass its own choice, RRG 1.8
 * "For Each", p. 20): spend 1 resource of any type (offered only to a player who can pay) or place 1 threat on the main
 * scheme (the spend is offered only to a player who can pay it: docs/phase7-wave7.md section 4.1 Q8 = A); exhaust a character they control (offered only while one is ready) or take 1 indirect damage.
 *
 * Cards (6):
 * - 60128a The Getaway (main_scheme)
 * - 60129a Out Front (attachment)
 * - 60130 Escort Vehicle (minion)
 * - 60131 Jackknifed Tanker Truck (side_scheme)
 * - 60132 Burning Rubber (treachery)
 * - 60133 Pedestrians (treachery)
 */
export const FNE_SCENARIOS_THE_GETAWAY: AbilityRegistry = defineAbilities({
  "60128a.setup": setup(
    addCounters("speed", ifElse(inMode("expert"), 2, 1), self),
    selectCards("front", encounterCards(["deck"], OUT_FRONT)),
    attachCard(chosen("front"), theVillain),
    shuffleEncounterDeck(),
  ),
  "60128b.the-getaway-forced-interrupt": forcedInterrupt(
    on.roundEnding(),
    { while: valueAtLeast(threatOn(self), 1) },
    addCounters("speed", 1, self),
    ifThen(exists(ALONGSIDE), flipCard(each(ALONGSIDE)), addCounters("speed", 1, self)),
  ),
  "60128b.the-getaway-constant": constant(),
  "60128b.the-getaway-constant-2": constant(),

  "60129a.out-front-constant": stateCheckFromEntering(
    valueEquals(threatOn(theMainScheme), 0),
    flipCard(self, { reveal: true }),
  ),
  "60129a.out-front-constant-2": constant(
    attacksGainKeywords(["ranged"], { attacker: query("villain", { hostOfSelf: true }) }),
  ),
  "60129a.out-front-forced-interrupt": forcedInterrupt(
    on.damage("host"),
    { wouldBeDealt: true },
    instead(removeThreat(eventAmount, theMainScheme, { ignoreCrisis: true })),
  ),
  "60129b.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, dealIndirectDamage(thatPlayer, 1)),
    dealDamage(perHero(2), theVillain),
  ),

  "60130.escort-vehicle-constant": constant(
    gainsKeyword({ name: "toughness" }, { self: true }, { while: speedAtLeast(3) }),
  ),
  "60130.escort-vehicle-constant-2": constant(
    gainsKeyword({ name: "quickstrike" }, { self: true }, { while: speedAtLeast(6) }),
  ),
  "60130.escort-vehicle-constant-3": constant(
    gainsKeyword({ name: "surge" }, { self: true }, { while: speedAtLeast(9) }),
  ),

  "60131.jackknifed-tanker-truck-constant": constant(
    rule({ kind: "cannotTakeDamage", target: query("villain"), stage: "dealt" }),
  ),

  "60132.when-revealed": whenRevealed(
    repeatTimes(
      SPEEDS,
      chooseOne(
        option("Spend 1 resource of any type", spendResources({ generic: 1 }, "spent")),
        option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)),
      ),
    ),
  ),
  "60133.when-revealed": whenRevealed(
    repeatTimes(
      SPEEDS,
      chooseOne(
        option(
          "Exhaust a character you control",
          { when: exists(query("character", { controller: "you", exhausted: false })) },
          chooseTarget("character", query("character", { controller: "you", exhausted: false })),
          exhaust(chosen("character")),
        ),
        option("Take 1 indirect damage", dealIndirectDamage(you, 1)),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_SCENARIOS_THE_GETAWAY_SKIPPED: Readonly<Record<string, string>> = {};
