import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/hard-sound` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50143 Songbird (minion)
 * - 50144 Solid Sound Constructs (attachment)
 * - 50145 Hard Sound Bindings (attachment)
 * - 50146 Sonic Bubble (side_scheme)
 * - 50147 Hard Sound (treachery)
 */
export const HARD_SOUND: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const HARD_SOUND_SKIPPED: Readonly<Record<string, string>> = {};
