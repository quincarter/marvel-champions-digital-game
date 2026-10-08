import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  confuse,
  defineAbilities,
  dealDamage,
  giveTough,
  inHand,
  on,
  removeThreat,
  response,
  theMainScheme,
  theVillain,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `aoa_basic_campaign` (campaign mode only; docs/phase7-wave8.md §1.27, §3.42).
 *
 * The four campaign allies share one shape: "Response: After [this ally] enters your hand, ..." is
 * `inHand(response(on.thisEntersYourHand(), ...))`, optional, each time it enters a hand (the b face's hand-out, a
 * draw, a search, the starting hand). Played to the mission they are blank like any ally.
 *
 * Skipped, see `AOA_BASIC_CAMPAIGN_SKIPPED`: Mission Team (cannot be discarded, the cost reduction by destination and
 * the mission attempt: tasks 34, 35, 37 and 38) and Desperate Measures (a considered resource icon, task 36).
 *
 * Cards (6):
 * - 45171a Mission Team (support)
 * - 45172 Destiny (ally)
 * - 45173 Blink (ally)
 * - 45174 Morph (ally)
 * - 45175 X-Man (ally)
 * - 45176 Desperate Measures (upgrade)
 */
const onEntersYourHand = (...effects: EffectSpec[]) => inHand(response(on.thisEntersYourHand(), ...effects));

export const AOA_BASIC_CAMPAIGN: AbilityRegistry = defineAbilities({
  // Response: After Destiny enters your hand, remove 2 threat from the main scheme.
  "45172.destiny-response": onEntersYourHand(removeThreat(2, theMainScheme)),
  // Response: After Blink enters your hand, deal 2 damage to the villain.
  "45173.blink-response": onEntersYourHand(dealDamage(2, theVillain)),
  // Response: After Morph enters your hand, confuse the villain.
  "45174.morph-response": onEntersYourHand(confuse(theVillain)),
  // Response: After X-Man enters your hand, give your identity a tough status card.
  "45175.x-man-response": onEntersYourHand(giveTough(yourIdentity)),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. */
export const AOA_BASIC_CAMPAIGN_SKIPPED: Readonly<Record<string, string>> = {
  "45171a.mission-team-constant":
    "'cannot be discarded' needs `cannotLeavePlay.by: \"discard\"` (task 34, section 3.35); 'the first player gains control' is `controlledByFirstPlayer`, registered with it",
  "45171a.mission-team-action":
    "'Make a mission attempt' needs the pairing (task 37) and sequential damage (task 38); the first option needs the area-bound cost reduction (task 35)",
  "45171b.mission-team-constant": "same as 45171a: task 34 (cannot be discarded)",
  "45171b.mission-team-action":
    "'choose a player to draw 1 card' is composable, but this face only exists after a mission flips Mission Team (tasks 34, 37 and 38), so it waits with 45171a",
  "45176.desperate-measures-constant":
    "'considered to have a wild resource icon' needs `consideredResourceIcon` (task 36, section 3.42); the stats and the reach into the mission area (`reaching`) are expressible now, but registering only those would be a wrong card",
};
