import { trait } from "@mc/content";
import {
  chooseTarget,
  chosen,
  constant,
  damageAnEnemy,
  defineAbilities,
  draw,
  gainsKeyword,
  gainsKeywordX,
  gets,
  query,
  removeThreatFromAScheme,
  special,
} from "../../../dsl/index.js";

const ELITE = trait("ELITE");
/** "Each character": friendly and enemy alike (the Storm insert, "The Weather Deck"; docs/phase7-wave6.md §6.2). */
const EACH_CHARACTER = query("character");

/**
 * Storm's four WEATHER supports (36002-36005): Permanent (a keyword on the card data; RRG 1.8 "Permanent", p. 32), each
 * in her facedown WEATHER deck rather than her player deck (docs/phase7-wave6.md §3.45, §3.46). One is put into play by
 * "I feel a storm coming..." and swapped by Weather Control (`identity.ts`), which resolves its Special. Each constant
 * applies to every character in play, enemies included.
 *
 * - **Clear Skies (36002)**: "Each character gains stalwart. Special: Draw 1 card."
 * - **Hurricane (36003)**: "Each character gains retaliate 1. Special: Remove 2 threat from a scheme." Not a thwart.
 * - **Thunderstorm (36004)**: "Each character gets +1 ATK. Special: Deal 2 damage to an enemy." Not an attack.
 * - **Blizzard (36005)**: "Each character gets -1 ATK. Special: Choose a non-ELITE minion -> until the end of the round,
 *   treat that minion's text box as if it were blank (except for TRAITS)." Vivian's shape (`wave5/ironheart/allies.ts`,
 *   29024): the engine never blanks traits, so "(except for TRAITS)" needs nothing more. With no non-ELITE minion in
 *   play there is nothing to choose and the Special does nothing.
 */
export const STORM_WEATHER = defineAbilities({
  "36002.clear-skies-constant": constant(gainsKeyword({ name: "stalwart" }, EACH_CHARACTER)),
  "36002.clear-skies-special": special(draw(1)),

  "36003.hurricane-constant": constant(gainsKeywordX("retaliate", 1, EACH_CHARACTER)),
  "36003.hurricane-special": special(removeThreatFromAScheme(2)),

  "36004.thunderstorm-constant": constant(gets("atk", 1, EACH_CHARACTER)),
  "36004.thunderstorm-special": special(damageAnEnemy(2)),

  "36005.blizzard-constant": constant(gets("atk", -1, EACH_CHARACTER)),
  "36005.blizzard-special": special(chooseTarget("minion", query("minion", { withoutTrait: ELITE })), {
    kind: "blankTextBox",
    target: chosen("minion"),
    until: "endOfRound",
  }),
});
