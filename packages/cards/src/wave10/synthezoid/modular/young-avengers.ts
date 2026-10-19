import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `young_avengers` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (5):
 * - 57055 Patriot (minion)
 * - 57056 Hawkeye (minion)
 * - 57057 Stature (minion)
 * - 57058 Teenage Superheroes (treachery)
 * - 57059 Young Avengers (side_scheme)
 */
export const SYNTHEZOID_MODULAR_YOUNG_AVENGERS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_YOUNG_AVENGERS_SKIPPED: Readonly<Record<string, string>> = {
  "57055.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/young-avengers)",
  "57056.hawkeye-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/young-avengers)",
  "57056.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/young-avengers)",
  "57057.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/young-avengers)",
  "57058.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/young-avengers)",
  "57059.young-avengers-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/young-avengers)",
};
