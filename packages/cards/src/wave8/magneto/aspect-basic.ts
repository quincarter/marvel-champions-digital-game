import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Magneto pack aspect and basic player cards. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (20):
 * - 49012 M (ally)
 * - 49013 Kid Omega (ally)
 * - 49014 Phoenix (ally)
 * - 49015 Cyclops (ally)
 * - 49016 Won't Stay Down (support)
 * - 49017 Squared Off (event)
 * - 49018 Noble Sacrifice (event)
 * - 49019 "You Got This!" (event)
 * - 49020 New Recruits (player_side_scheme)
 * - 49021 White Queen (ally)
 * - 49022 Face the Past (event)
 * - 49023 Deft Focus (upgrade)
 * - 49024 Energy (resource)
 * - 49025 Genius (resource)
 * - 49026 Strength (resource)
 * - 49033 Surge (ally)
 * - 49034 Anole (ally)
 * - 49035 Bling! (ally)
 * - 49036 Indra (ally)
 * - 49037 Children of the Atom (support)
 */
export const MAGNETO_ASPECT_BASIC: AbilityRegistry = defineAbilities({});
