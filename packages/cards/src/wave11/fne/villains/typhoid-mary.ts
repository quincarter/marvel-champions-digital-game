import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Typhoid Mary (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (11):
 * - 60110b Bloody Mary (villain)
 * - 60112 Disturbed Psyche (environment)
 * - 60113a Establish Trust (side_scheme)
 * - 60113b Mary Walker (attachment)
 * - 60114 Telekinesis (attachment)
 * - 60115 Psionic Slash (treachery)
 * - 60116 Psi Nova (treachery)
 * - 60117 Assembled Armor (attachment)
 * - 60118 Hail of Blades (treachery)
 * - 60119 Scavenged Bulwark (treachery)
 * - 60120 Hand Lookout (minion)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_VILLAINS_TYPHOID_MARY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_TYPHOID_MARY_SKIPPED: Readonly<Record<string, string>> = {
  "60110b.bloody-mary-forced-interrupt": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60111b.when-revealed": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60111b.bloody-mary-forced-interrupt": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60110a.typhoid-mary-forced-interrupt": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60111a.typhoid-mary-forced-interrupt": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60112.setup": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60112.disturbed-psyche-forced-interrupt": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60112.disturbed-psyche-constant": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60113a.establish-trust-constant": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60113a.when-defeated": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60113b.mary-walker-constant": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60113b.mary-walker-forced-response": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60114.telekinesis-action": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60114.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60115.when-revealed": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60115.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60116.when-revealed": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60116.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60117.assembled-armor-forced-interrupt": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60117.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60118.when-revealed": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60118.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60119.when-revealed": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60119.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
  "60120.boost": "wave 11 scripting in progress: fne/villains/typhoid-mary",
};
