import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  anEnemy,
  chooseOne,
  chooseTarget,
  chosen,
  defineAbilities,
  dealDamage,
  discardThis,
  exhaustThis,
  hasTrait,
  heal,
  identityOf,
  interrupt,
  modifyAttack,
  option,
  query,
  removeCounter,
  removeThreatFromAScheme,
  resource,
  response,
  when,
  you,
} from "../../../dsl/index.js";
import { SHIELD_SUPPORTS } from "./identity.js";

const SHIELD = trait("S.H.I.E.L.D.");

/**
 * Wave 9 scripting module `aos/maria-hill/support-upgrades-allies` (docs/phase7-wave9.md section 8.4, 3.6, 3.35).
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **50002.nick-fury-response**: "After Nick Fury uses a basic power, place 1 all-purpose counter on a S.H.I.E.L.D.
 * support." The counter takes the type the support defines (RRG 1.8 "All-Purpose Counter", p. 6; MC50 p. 4).
 *
 * **50008.support-staff-resource**: "Resource: Exhaust Support Staff and remove 1 staff counter from it -> generate a
 * [wild] resource for a player whose identity has the S.H.I.E.L.D. trait." `forAnyPlayer` lets another player pay with
 * it and the `while` gate (read with "you" as the player spending it) is that player's identity trait.
 * Removing the last staff counter discards the card (RRG 1.8 "Uses", p. 46).
 *
 * **50009.the-iliad-action**: the cost is exhausting and removing 1 mission counter; the three modes are plain
 * (non-attack, non-thwart) damage, threat removal and healing, so no Guard, Retaliate or "after you thwart" is read.
 *
 * **50010.life-model-decoy-interrupt**: "When an enemy attacks you, discard this -> prevent all damage from that
 * attack." Set at the attack's initiation (`modifyAttack.preventAllDamage`, Mockingbird's shape).
 *
 * **50011.shield-director-action**: "Exhaust S.H.I.E.L.D. Director -> place 1 all-purpose counter on a S.H.I.E.L.D.
 * support."
 *
 * Cards (5):
 * - 50002 Nick Fury (ally)
 * - 50008 Support Staff (support)
 * - 50009 The Iliad (support)
 * - 50010 Life Model Decoy (upgrade)
 * - 50011 S.H.I.E.L.D. Director (upgrade)
 */
export const MARIA_HILL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "50002.nick-fury-response": response(
    after.basicPowerUsed("self"),
    chooseTarget("support", SHIELD_SUPPORTS),
    addCounters("allPurpose", 1, chosen("support")),
  ),

  "50008.support-staff-resource": resource(
    { wild: 1 },
    {
      cost: [exhaustThis, removeCounter("staff")],
      forAnyPlayer: true,
      while: hasTrait(identityOf(you), SHIELD),
    },
  ),

  "50009.the-iliad-action": action(
    { cost: [exhaustThis, removeCounter("mission")] },
    chooseOne(
      option("Deal 5 damage to an enemy", anEnemy("enemy"), dealDamage(5, chosen("enemy"))),
      option("Remove 4 threat from a scheme", ...removeThreatFromAScheme(4)),
      option(
        "Heal 3 damage from an identity",
        chooseTarget("identity", query("identity")),
        heal(3, chosen("identity")),
      ),
    ),
  ),

  "50010.life-model-decoy-interrupt": interrupt(
    when.enemyAttacks({ categories: ["enemy"] }, { againstYou: true }),
    { cost: discardThis },
    modifyAttack({ preventAllDamage: true }),
  ),

  "50011.shield-director-action": action(
    { cost: exhaustThis },
    chooseTarget("support", SHIELD_SUPPORTS),
    addCounters("allPurpose", 1, chosen("support")),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
