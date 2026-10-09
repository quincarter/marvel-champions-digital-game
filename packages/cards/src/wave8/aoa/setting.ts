import { trait } from "@mc/content";
import type { AbilityCost, EffectSpec, PlayerRef } from "@mc/engine";
import { chooseTarget, chosen, each, query, resolveSpecialCost, resolveSpecialsOf, you } from "../../dsl/index.js";

/**
 * "The Setting environment" (Age of Apocalypse: The Savage Land 45127, Genosha 45133, Blue Area of the Moon 45139),
 * shared by the Dark Beast scenario and the three Setting sets (docs/phase7-wave8.md §3.24).
 */
export const SETTING = trait("SETTING");
export const SETTING_ENVIRONMENT = query("environment", { trait: SETTING });

/**
 * "Resolve the 'Special' ability on the Setting environment", by `who`: the resolving player chooses which Setting when
 * several are in play (§4.1 Q15 = A) and is "you" inside the Special (the environment has no controller of its own).
 * Nothing is asked and nothing resolves with no Setting environment in play.
 */
export const resolveSettingSpecial = (who: PlayerRef = you): EffectSpec[] => [
  chooseTarget("setting", SETTING_ENVIRONMENT, { chooser: who }),
  resolveSpecialsOf(chosen("setting"), who),
];

/**
 * "Resolve the 'Special' ability on the Setting environment →" as a cost (§3.24): the paying player is "you" inside
 * the Special and picks which Setting when several are in play (Q15 = A, bound to "setting"). Not payable, so the
 * ability is not offered, with no Setting environment in play or while its Special would change nothing (Q7 = A).
 */
export const resolveSettingSpecialCost: AbilityCost = resolveSpecialCost(each(SETTING_ENVIRONMENT), {
  choose: "setting",
});
