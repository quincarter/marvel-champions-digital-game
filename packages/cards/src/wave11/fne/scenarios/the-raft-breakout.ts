import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Raft Breakout scenario (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (9):
 * - 60142a The Raft Breakout (main_scheme)
 * - 60143 Master Key (attachment)
 * - 60144 Absorbing Man (minion)
 * - 60145 Baron Zemo (minion)
 * - 60146 Drang (minion)
 * - 60147 Mysterio (minion)
 * - 60148 Proxima Midnight (minion)
 * - 60149 Rhino (minion)
 * - 60150 Imprisoned (obligation)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_SCENARIOS_THE_RAFT_BREAKOUT: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_THE_RAFT_BREAKOUT_SKIPPED: Readonly<Record<string, string>> = {
  "60142a.setup": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60142b.the-raft-breakout-constant": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60143.master-key-forced-response": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60144.absorbing-man-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60145.baron-zemo-constant": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60145.when-revealed": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60146.drang-forced-response": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60147.mysterio-forced-response": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60148.proxima-midnight-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60149.rhino-constant": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60149.boost": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60150.obligation": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60150.imprisoned-action": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
  "60150.boost": "wave 11 scripting in progress: fne/scenarios/the-raft-breakout",
};
