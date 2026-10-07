import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `aoa_mission` (campaign mode only). Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (10):
 * - 45166a Liberate the Seattle Core (side_scheme)
 * - 45166b Liberate the Seattle Core (side_scheme)
 * - 45167a Evacuate Survivors (side_scheme)
 * - 45167b Evacuate Survivors (side_scheme)
 * - 45168a Sabotage the Sea Wall (side_scheme)
 * - 45168b Sabotage the Sea Wall (side_scheme)
 * - 45169a Find Lost Mutants (side_scheme)
 * - 45169b Find Lost Mutants (side_scheme)
 * - 45170a Protect the Professor (side_scheme)
 * - 45170b Protect the Professor (side_scheme)
 */
export const AOA_MISSION: AbilityRegistry = defineAbilities({});
