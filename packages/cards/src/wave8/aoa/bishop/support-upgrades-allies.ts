import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Bishop signature supports, upgrades, allies and resources. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45002 Malcolm (ally)
 * - 45003 Randall (ally)
 * - 45004 Bishop's Rifle (upgrade)
 * - 45005 Bishop's Uniform (upgrade)
 * - 45006 Super-Charged (upgrade)
 * - 45010 Stored Energy (resource)
 */
export const BISHOP_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
