import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The two Standard PvP sets (57036 to 57039b, 57078 to 57081b) of Synthezoid Smackdown (MC57;
 * docs/phase7-synthezoid.md section 8.3 item 14). Competitive only: an empty registry and every ref skipped with the
 * reason "competitive mode not shipped" (section 6) until competitive mode exists.
 *
 * Cards (10):
 * - 57036 Righteous Cause (treachery)
 * - 57037 Whatever It Takes (treachery)
 * - 57038 Targeted Strike (treachery)
 * - 57039a Choosing Sides (side_scheme)
 * - 57039b Now It's Personal (obligation)
 * - 57078 Righteous Cause (treachery)
 * - 57079 Whatever It Takes (treachery)
 * - 57080 Targeted Strike (treachery)
 * - 57081a Choosing Sides (side_scheme)
 * - 57081b Now It's Personal (obligation)
 */
export const SYNTHEZOID_COMPETITIVE_STANDARD_PVP: AbilityRegistry = defineAbilities({});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const SYNTHEZOID_COMPETITIVE_STANDARD_PVP_SKIPPED: Readonly<Record<string, string>> = {
  "57036.when-revealed": "competitive mode not shipped",
  "57037.when-revealed-alter-ego": "competitive mode not shipped",
  "57037.when-revealed-hero": "competitive mode not shipped",
  "57038.when-revealed": "competitive mode not shipped",
  "57038.boost": "competitive mode not shipped",
  "57039a.choosing-sides-constant": "competitive mode not shipped",
  "57039a.choosing-sides-forced-response": "competitive mode not shipped",
  "57039b.now-its-personal-constant": "competitive mode not shipped",
  "57039b.now-its-personal-action": "competitive mode not shipped",
  "57078.when-revealed": "competitive mode not shipped",
  "57079.when-revealed-alter-ego": "competitive mode not shipped",
  "57079.when-revealed-hero": "competitive mode not shipped",
  "57080.when-revealed": "competitive mode not shipped",
  "57080.boost": "competitive mode not shipped",
  "57081a.choosing-sides-constant": "competitive mode not shipped",
  "57081a.choosing-sides-forced-response": "competitive mode not shipped",
  "57081b.now-its-personal-constant": "competitive mode not shipped",
  "57081b.now-its-personal-action": "competitive mode not shipped",
};
