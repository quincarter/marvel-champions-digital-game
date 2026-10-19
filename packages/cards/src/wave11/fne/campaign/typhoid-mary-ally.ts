import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Typhoid Mary campaign ally (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (1):
 * - 60210a Typhoid Mary (ally)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_CAMPAIGN_TYPHOID_MARY_ALLY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_CAMPAIGN_TYPHOID_MARY_ALLY_SKIPPED: Readonly<Record<string, string>> = {
  "60210a.typhoid-mary-forced-response": "wave 11 scripting in progress: fne/campaign/typhoid-mary-ally",
  "60210b.bloody-mary-forced-response": "wave 11 scripting in progress: fne/campaign/typhoid-mary-ally",
};
