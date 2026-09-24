import {
  chooseOne,
  constant,
  dealDamage,
  defineAbilities,
  discardFromHand,
  discard,
  eachPlayer,
  enemyAttack,
  exhaust,
  enemyScheme,
  exhaustCardsCost,
  exhaustThis,
  firstPlayer,
  firstPlayerAction,
  forcedInterrupt,
  forEachPlayer,
  identityOf,
  named,
  on,
  option,
  partOf,
  query,
  resource,
  rule,
  self,
  spend,
  spendResources,
  stun,
  thatPlayer,
  theVillain,
  you,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
} from "../../dsl/index.js";
import { removeThreat } from "../../dsl/effects.js";

/**
 * Ship Command (16142–16148), the modular set every `gmw` Ship Command scenario uses (docs/phase7-wave3.md §2.2):
 * the Milano itself (16142), Rogue Vessel (16143), Cannonade (16144), and the treacheries Blind Side (16145), Hull
 * Breach (16146), Power Siphon (16147) and Special Delivery (16148).
 */

/** "Exhaust the Milano" as a cost — Milano is unique, so this always names the one in play. */
const exhaustMilano = exhaustCardsCost(query("support", { name: "Milano" }));

export const SHIP_COMMAND = defineAbilities({
  // Milano — Permanent. Setup.
  // The first player controls the Milano.
  // Piloting - Resource: Exhaust the Milano → generate a [wild] resource for any player.
  "16142.milano-constant": constant(rule({ kind: "controlledByFirstPlayer", target: { self: true } })),
  "16142.milano-constant-2": resource(1, { cost: exhaustThis, forAnyPlayer: true }),

  // Rogue Vessel — Surge.
  // Forced Interrupt: When the villain phase ends, deal 1 damage to each player.
  // First Player Action: Exhaust the Milano and spend 2 resources of any type → discard this card.
  "16143.rogue-vessel-forced-interrupt": forcedInterrupt(
    on.phaseEnding("villain"),
    forEachPlayer(eachPlayer, dealDamage(1, identityOf(thatPlayer))),
  ),
  "16143.rogue-vessel-constant": firstPlayerAction({ cost: [exhaustMilano, spend(2)] }, discard(self)),

  // Cannonade — Hinder 3[per_hero] (data-driven: `keywords`).
  // First Player Action: Exhaust the Milano → remove 3 threat from this scheme.
  "16144.cannonade-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Blind Side — Peril. When Revealed: Choose one:
  // - Exhaust the Milano.
  // - Spend [physical][physical] resources.
  // - Stun the first player.
  "16145.when-revealed": whenRevealed(
    chooseOne(
      option("Exhaust the Milano", exhaust(named("Milano"))),
      option("Spend physical physical resources", spendResources({ physical: 2 }, "spent")),
      option("Stun the first player", stun(identityOf(firstPlayer))),
    ),
  ),
  "16145.blind-side-constant": partOf("16145.when-revealed"),
  "16145.blind-side-constant-2": partOf("16145.when-revealed"),
  "16145.blind-side-constant-3": partOf("16145.when-revealed"),

  // Hull Breach — Peril. When Revealed: Choose one:
  // - Exhaust the Milano.
  // - Spend [mental][mental] resources.
  // - Deal 3 damage to the first player.
  "16146.when-revealed": whenRevealed(
    chooseOne(
      option("Exhaust the Milano", exhaust(named("Milano"))),
      option("Spend mental mental resources", spendResources({ mental: 2 }, "spent")),
      option("Deal 3 damage to the first player", dealDamage(3, identityOf(firstPlayer))),
    ),
  ),
  "16146.hull-breach-constant": partOf("16146.when-revealed"),
  "16146.hull-breach-constant-2": partOf("16146.when-revealed"),
  "16146.hull-breach-constant-3": partOf("16146.when-revealed"),

  // Power Siphon — Peril. When Revealed: Choose one:
  // - Exhaust the Milano.
  // - Spend [energy][energy] resources.
  // - Discard 1 card at random from the first player's hand.
  "16147.when-revealed": whenRevealed(
    chooseOne(
      option("Exhaust the Milano", exhaust(named("Milano"))),
      option("Spend energy energy resources", spendResources({ energy: 2 }, "spent")),
      option(
        "Discard 1 card at random from the first player's hand",
        discardFromHand(1, firstPlayer, { random: true }),
      ),
    ),
  ),
  "16147.power-siphon-constant": partOf("16147.when-revealed"),
  "16147.power-siphon-constant-2": partOf("16147.when-revealed"),
  "16147.power-siphon-constant-3": partOf("16147.when-revealed"),

  // Special Delivery — When Revealed (Alter-Ego): You may exhaust the Milano. If you do not, the villain schemes
  // with +1 SCH. When Revealed (Hero): You may exhaust the Milano. If you do not, the villain attacks you with +1
  // ATK. Modeled as a binary "Choose one" (docs/card-scripting-process.md's DSL vocabulary), since the two outcomes
  // are mutually exclusive and the printed text is itself a binary "may/if not".
  "16148.when-revealed-alter-ego": whenRevealedAlterEgo(
    chooseOne(
      option("Exhaust the Milano", exhaust(named("Milano"))),
      option("The villain schemes with +1 SCH", enemyScheme(theVillain, { against: you, schBonus: 1 })),
    ),
  ),
  "16148.when-revealed-hero": whenRevealedHero(
    chooseOne(
      option("Exhaust the Milano", exhaust(named("Milano"))),
      option("The villain attacks you with +1 ATK", enemyAttack(theVillain, { against: you, atkBonus: 1 })),
    ),
  ),
});
