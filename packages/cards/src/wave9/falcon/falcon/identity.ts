import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/falcon/identity` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (1):
 * - 53001a Falcon (hero_identity)
 */
export const FALCON_IDENTITY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
