import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/justice` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (4):
 * - 63034 Double-Cross (player_side_scheme)
 * - 63035 Backstab (treachery)
 * - 63036 Misdirect (treachery)
 * - 63037 Sabotage (treachery)
 */
export const ELEKTRA_JUSTICE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {
  "63034.when-defeated": "not scripted yet: Double-Cross when defeated",
  "63035.when-revealed": "not scripted yet: Backstab when revealed",
  "63035.boost": "not scripted yet: Backstab boost",
  "63036.when-revealed": "not scripted yet: Misdirect when revealed",
  "63036.boost": "not scripted yet: Misdirect boost",
  "63037.when-revealed": "not scripted yet: Sabotage when revealed",
  "63037.boost": "not scripted yet: Sabotage boost",
};
