import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/aspect-basic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (17):
 * - 54012 Captain America (ally)
 * - 54013 Deathlok (ally)
 * - 54014 Firepower (event)
 * - 54015 One by One (event)
 * - 54016 Spoiling for a Fight (event)
 * - 54017 Aggressive Stance (upgrade)
 * - 54018 Bambino (upgrade)
 * - 54019 Man on the Wall (upgrade)
 * - 54020 S.H.I.E.L.D. Sidearm (upgrade)
 * - 54021 Nick Fury, Sr. (ally)
 * - 54022 Super-Soldiers (event)
 * - 54023 Winter, Widow, Soldier, Spy (event)
 * - 54024 Energy (resource)
 * - 54025 Genius (resource)
 * - 54026 Strength (resource)
 * - 54032 White Widow (ally)
 * - 54033 S.H.I.E.L.D. Deputy (upgrade)
 */
export const WINTER_ASPECT_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
