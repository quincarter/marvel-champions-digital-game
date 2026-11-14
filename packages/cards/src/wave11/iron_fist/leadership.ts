import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  andThen,
  chooseTarget,
  chosen,
  constant,
  damageOn,
  defineAbilities,
  exactlyDefeatedByPower,
  heal,
  ifThen,
  query,
  rule,
  takesConsequentialDamage,
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
 * sustained damage, heal 1 damage from another character." Settled by the rules expert (2026-11-14): a target is valid
 * only if the ability can affect it (RRG 1.8 "Target", p. 42), and only the first heal can affect the Martial Artist,
 * so only a Martial Artist with at least 1 damage can be chosen (none damaged: the card cannot be played). The second
 * sentence is a printed "Then" (RRG 1.8 "Then", p. 44; "Resolve", p. 37): it happens only if the first heal resolved
 * and left that character at 0 damage, and the other character is chosen after the first heal. Same reading as the
 * Peter Porker basic recovery ruling (May 2023, docs/rulings/post-rrg-1-5/01-may-2023.md) and Ionic Physiology
 * (March 6, 2026, Ruling 3).
 *
 * **64032.sensei-constant**: an ally consequential-damage rule (`takesConsequentialDamage`) whose `if` reads the results
 * the ally's power reported into its consequential damage (`exactlyDefeatedByPower`): an attack that defeated an enemy
 * dealing no excess damage (dealt, not taken: FFG ruling August 3, 2026 (6)), or a thwart that defeated a side scheme
 * attempting no more threat than it had (MC60 p. 4). "Martial Artist ally" is read as the damage is dealt. Discount 2
 * (Martial Artist) and Max 1 per player are data.
 */
export const IRON_FIST_LEADERSHIP: AbilityRegistry = defineAbilities({
  "64031.zen-like-calm-action": action(
    chooseTarget("artist", query("character", { trait: MARTIAL_ARTIST, damaged: true })),
    heal(1, chosen("artist")),
    andThen(
      ifThen(valueEquals(damageOn(chosen("artist")), 0), [
        chooseTarget("other", query("character", { excluding: chosen("artist") })),
        heal(1, chosen("other")),
      ]),
    ),
  ),

  "64032.sensei-constant": constant(
    rule(
      takesConsequentialDamage(query("ally", { trait: MARTIAL_ARTIST, controller: "you" }), -2, {
        if: exactlyDefeatedByPower,
      }),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {};
