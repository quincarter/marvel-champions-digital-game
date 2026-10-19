import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Protection Racket scenario (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (4):
 * - 60134a Protection Racket (main_scheme)
 * - 60139 Shop Proprietor (ally)
 * - 60140 Man-Bull (minion)
 * - 60141 Change of Venue (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_SCENARIOS_PROTECTION_RACKET: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_PROTECTION_RACKET_SKIPPED: Readonly<Record<string, string>> = {
  "60134a.setup": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60134b.battle-in-the-bodega-forced-response": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60134b.battle-in-the-bodega-constant": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60135a.setup": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60135b.bull-in-a-china-shop-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60135b.bull-in-a-china-shop-constant": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60136a.setup": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60136b.hung-out-to-dry-forced-response": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60136b.hung-out-to-dry-constant": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60137a.setup": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60137b.pawn-shop-showdown-constant": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60137b.pawn-shop-showdown-forced-response": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60137b.pawn-shop-showdown-constant-2": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60138a.setup": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60138b.a-slice-of-the-pizza-dough-forced-response": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60138b.a-slice-of-the-pizza-dough-constant": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60139.when-revealed": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60139.shop-proprietor-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60140.man-bull-forced-response": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60140.boost": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60141.when-revealed": "wave 11 scripting in progress: fne/scenarios/protection-racket",
  "60141.boost": "wave 11 scripting in progress: fne/scenarios/protection-racket",
};
