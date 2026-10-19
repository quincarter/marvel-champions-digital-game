import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The eight leader player cards (She-Hulk 57032 to 57035, Vision 57074 to 57077) of Synthezoid Smackdown (MC57;
 * docs/phase7-synthezoid.md section 8.3 item 14). Competitive only: an empty registry and every ref skipped with the
 * reason "competitive mode not shipped" (section 6) until competitive mode exists.
 *
 * Cards (8):
 * - 57032 You're Out of Order! (event)
 * - 57033 She-Hulk Smash (event)
 * - 57034 Make Me Angry (upgrade)
 * - 57035 Legal Counsel (resource)
 * - 57074 Calculated Risk (event)
 * - 57075 Synthezoid Strike (event)
 * - 57076 Phased Out (event)
 * - 57077 Android Assistance (resource)
 */
export const SYNTHEZOID_COMPETITIVE_LEADER_CARDS: AbilityRegistry = defineAbilities({});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const SYNTHEZOID_COMPETITIVE_LEADER_CARDS_SKIPPED: Readonly<Record<string, string>> = {
  "57032.youre-out-of-order-interrupt": "competitive mode not shipped",
  "57033.she-hulk-smash-action": "competitive mode not shipped",
  "57034.make-me-angry-forced-response": "competitive mode not shipped",
  "57035.legal-counsel-response": "competitive mode not shipped",
  "57074.calculated-risk-action": "competitive mode not shipped",
  "57075.synthezoid-strike-action": "competitive mode not shipped",
  "57076.phased-out-action": "competitive mode not shipped",
  "57077.android-assistance-interrupt": "competitive mode not shipped",
};
