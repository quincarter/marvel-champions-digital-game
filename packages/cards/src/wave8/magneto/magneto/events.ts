import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  andThen,
  anAttackableEnemy,
  anEnemy,
  attack,
  chooseTarget,
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  giveTough,
  heroAction,
  ifThen,
  not,
  printsAbility,
  query,
  stun,
  threatAtLeast,
  thwart,
  varAtLeast,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * Magneto signature events (docs/phase7-wave8.md section 7.5, 3.76, 3.77, 3.81).
 *
 * **Metal Shards (49009)**: a Hero Action (attack): 7 damage to an enemy the hero may attack (guard applies); if that
 * attack defeated it (`attack`'s `bind` reports `<bind>.defeated`), Magneto gains a tough status card.
 *
 * **Magnetic Missile (49010)**, as errata (RRG 1.8 p. 69, current text "Discard a minion with Wrapped in Metal
 * attached. Then, deal 5 damage to an enemy and stun it."): the discard is the first effect, not a cost, and the damage
 * waits on it (`andThen`). The minion is discarded, not defeated (`discard`); any player's wrapped minion will do. With
 * no wrapped minion in play there is nothing to choose and the event cannot be played. It carries no label, so the 5
 * damage is not an attack: guard does not stop it and retaliate does not answer.
 *
 * **Electromagnetic Blast (49008)**: a Hero Action (thwart): 3 threat off a scheme. "If this removes the last threat
 * from that scheme" is read as the scheme having no threat left after the thwart, whether it removed 3 or fewer
 * (section 3.77). Then the player may discard "an attachment with the text 'Hero Action' or 'Hero Response'": an
 * encounter attachment (a player upgrade on an enemy is not one) that prints one of those two labels, read from the
 * card's printed abilities (`printsAbility`), so a blanked attachment is still a choice and "Hero Interrupt", a plain
 * "Action" and a Forced Response are not. It is a discard, not a defeat.
 *
 * Cards (3):
 * - 49008 Electromagnetic Blast (event)
 * - 49009 Metal Shards (event)
 * - 49010 Magnetic Missile (event)
 */
export const MAGNETO_EVENTS: AbilityRegistry = defineAbilities({
  "49008.electromagnetic-blast-action": heroAction(
    { label: "thwart" },
    aScheme(),
    thwart(3, chosen("scheme")),
    ifThen(not(threatAtLeast(chosen("scheme"), 1)), [
      chooseTarget("attachment", query("attachment", printsAbility(["action", "response"], "hero")), {
        optional: true,
      }),
      discard(chosen("attachment")),
    ]),
  ),

  "49009.metal-shards-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(7, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), giveTough(yourIdentity)),
  ),

  "49010.magnetic-missile-action": heroAction(
    chooseTarget("wrapped", query("minion", { hasAttachment: { name: "Wrapped in Metal" } })),
    discard(chosen("wrapped")),
    andThen(anEnemy(), dealDamage(5, chosen("enemy")), stun(chosen("enemy"))),
  ),
});

/** Refs of this group left unregistered, each with its reason. */
export const MAGNETO_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
