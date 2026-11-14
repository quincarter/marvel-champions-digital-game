import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  andThen,
  chooseTarget,
  chosen,
  damageOn,
  defineAbilities,
  heal,
  ifThen,
  query,
  valueEquals,
} from "../../dsl/index.js";

const MARTIAL_ARTIST = trait("MARTIAL ARTIST");

/**
 * Wave 11 scripting module `iron_fist/leadership` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (2):
 * - 64031 Zen-Like Calm (event)
 * - 64032 Sensei (upgrade)
 *
 * **64031.zen-like-calm-action**: "Heal 1 damage from a Martial Artist character. Then, if that character has no
 * sustained damage, heal 1 damage from another character." The second sentence is a printed "Then" (RRG 1.8 p. 44):
 * it runs only if the heal resolved. The condition is read after the first heal, on the same character. Both choices
 * are any character with the trait / any other character (enemies included; nothing limits them to friendly ones).
 * FLAG: whether healing 0 from an undamaged Martial Artist counts as the first sentence resolving (and so lets the
 * second one run) is not settled by the sources checked; this reads it as resolved, since the heal is not prevented.
 */
export const IRON_FIST_LEADERSHIP: AbilityRegistry = defineAbilities({
  "64031.zen-like-calm-action": action(
    chooseTarget("artist", query("character", { trait: MARTIAL_ARTIST })),
    heal(1, chosen("artist")),
    andThen(
      ifThen(valueEquals(damageOn(chosen("artist")), 0), [
        chooseTarget("other", query("character", { excluding: chosen("artist") })),
        heal(1, chosen("other")),
      ]),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {
  "64032.sensei-constant":
    "needs engine primitive: 'exactly defeat a side scheme' readable in an ally's consequential-damage scope (a thwart's excess-threat result is not reported to the thwart's bind, only to the schemeDefeated event); the enemy half is attack.defeated with attack.excessAsDealt 0",
};
