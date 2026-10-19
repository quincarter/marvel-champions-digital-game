import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Electro (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (8):
 * - 60076 Electro (villain)
 * - 60079 Electric Charge (attachment)
 * - 60080 Drained of Power (attachment)
 * - 60081 Whiplash (minion)
 * - 60082 Charging Up (side_scheme)
 * - 60083 Chain Lightning (treachery)
 * - 60084 Energy Overload (treachery)
 * - 60085 Shocking Revelation (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_VILLAINS_ELECTRO: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_ELECTRO_SKIPPED: Readonly<Record<string, string>> = {
  "60076.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
  "60076.electro-forced-response": "wave 11 scripting in progress: fne/villains/electro",
  "60077.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
  "60077.electro-forced-response": "wave 11 scripting in progress: fne/villains/electro",
  "60078.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
  "60078.electro-forced-response": "wave 11 scripting in progress: fne/villains/electro",
  "60079.electric-charge-forced-interrupt": "wave 11 scripting in progress: fne/villains/electro",
  "60079.electric-charge-action": "wave 11 scripting in progress: fne/villains/electro",
  "60080.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
  "60080.drained-of-power-forced-interrupt": "wave 11 scripting in progress: fne/villains/electro",
  "60081.whiplash-forced-interrupt": "wave 11 scripting in progress: fne/villains/electro",
  "60082.when-defeated": "wave 11 scripting in progress: fne/villains/electro",
  "60083.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
  "60084.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
  "60085.when-revealed": "wave 11 scripting in progress: fne/villains/electro",
};
