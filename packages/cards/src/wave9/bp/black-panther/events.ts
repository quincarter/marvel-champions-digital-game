import type { AbilityRegistry } from "@mc/engine";
import { attackAnEnemy, defineAbilities, heroAction, resolveSpecials, thwartAScheme } from "../../../dsl/index.js";
import { RESOLVE_ONE_SPECIAL, YOUR_BLACK_PANTHER_UPGRADES } from "./identity.js";

/**
 * Wave 9 scripting module `bp/black-panther/events` (docs/phase7-wave9.md section 8.4, 3.36).
 *
 * Cards (4):
 * - 51003 Clawed Strike (event): "Hero Action (attack): Deal 4 damage to an enemy. Resolve the 'Special' ability on 1
 *   Black Panther upgrade you control." The 4 damage is an attack (the "(attack)" label), so guard applies to the
 *   chosen enemy; the Special follows it as a separate step, and with no such upgrade nothing is asked.
 * - 51004 On the Prowl (event): the same with "(thwart): Remove 3 threat from a scheme".
 * - 51005 Wakanda Forever! (event): Core's 01043 wording, "each Black Panther upgrade you control in any order".
 * - 51006 Vibranium (resource): no text; it only produces its two wild icons, so it has no ability ref.
 */
export const BLACK_PANTHER_EVENTS: AbilityRegistry = defineAbilities({
  "51003.clawed-strike-action": heroAction({ label: "attack" }, attackAnEnemy(4), ...RESOLVE_ONE_SPECIAL),
  "51004.on-the-prowl-action": heroAction({ label: "thwart" }, thwartAScheme(3), ...RESOLVE_ONE_SPECIAL),
  "51005.wakanda-forever-action": heroAction(resolveSpecials(YOUR_BLACK_PANTHER_UPGRADES)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
