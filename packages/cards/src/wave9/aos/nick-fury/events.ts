import type { AbilityRegistry } from "@mc/engine";
import {
  anAttackableEnemy,
  aScheme,
  attack,
  changeAdditionalForm,
  chooseOne,
  choosePlayer,
  chosen,
  chosenPlayer,
  dealDamage,
  defineAbilities,
  each,
  heroAction,
  ifThen,
  inAdditionalForm,
  option,
  placeThreat,
  printedStatOf,
  query,
  theVillain,
  thwart,
  varAtLeast,
  varOf,
} from "../../../dsl/index.js";
import { YOUR_SUIT_FORM } from "./identity.js";

/**
 * Wave 9 scripting module `aos/nick-fury/events` (docs/phase7-wave9.md section 8.4, 3.7, 3.8).
 *
 * Cards (3):
 * - 50037 Concentrated Fire (event): "Hero Action (attack): Deal 4 damage to an enemy. This attack gains ranged. If
 *   this attack defeats an enemy, choose: place threat on your suit form upgrade equal to that enemy's printed SCH, or
 *   change to Stealth suit form." The attack is the labeled attack (guard applies); the choice follows only a defeat
 *   by it. The printed SCH is read off the defeated enemy (modifiers ignored; "-" reads 0, so a 0 SCH places nothing).
 * - 50038 Covert Surveillance (event): "Hero Action (thwart): Remove 2 threat from a scheme. If you are in Stealth suit
 *   form, you may place that threat on your suit form upgrade. Otherwise, you may change to Stealth suit form." "That
 *   threat" is what the thwart actually removed (a scheme with 1 threat gives 1). The two "may" branches are one
 *   either-or on the form you were in when the thwart finished.
 * - 50039 Spray Fire (event): "Hero Action (attack): Choose a player. Deal 3 damage to the villain and each minion
 *   engaged with that player. This attack gains ranged." One attack (docs/phase7-wave9.md section 4.1 Q4, default A):
 *   the villain is the attack's target and each engaged minion takes the same attack's damage (RRG 1.8 "Attack (Player
 *   Ability Type)", p. 10).
 */
export const NICK_FURY_EVENTS: AbilityRegistry = defineAbilities({
  "50037.concentrated-fire-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(4, chosen("enemy"), { keywords: ["ranged"], bind: "hit" }),
    ifThen(
      varAtLeast("hit.defeated"),
      chooseOne(
        option(
          "Place threat on your suit form upgrade",
          placeThreat(printedStatOf(chosen("enemy"), "sch"), YOUR_SUIT_FORM),
        ),
        option("Change to Stealth suit form", changeAdditionalForm("suit", { toName: "Stealth" })),
      ),
    ),
  ),

  "50038.covert-surveillance-action": heroAction(
    { label: "thwart" },
    aScheme(),
    thwart(2, chosen("scheme"), { bind: "removed" }),
    ifThen(
      inAdditionalForm("suit", "Stealth"),
      chooseOne(
        option("Place that threat on your suit form upgrade", placeThreat(varOf("removed.amount"), YOUR_SUIT_FORM)),
        option("Decline", []),
      ),
      chooseOne(
        option("Change to Stealth suit form", changeAdditionalForm("suit", { toName: "Stealth" })),
        option("Decline", []),
      ),
    ),
  ),

  "50039.spray-fire-action": heroAction(
    { label: "attack" },
    choosePlayer("player"),
    attack(3, theVillain, { keywords: ["ranged"] }),
    dealDamage(3, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
