import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Superhero Registration Act main scheme (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (1):
 * - 57005a Superhero Registration Act (main_scheme)
 */
export const SYNTHEZOID_MAIN_SCHEMES_REGISTRATION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MAIN_SCHEMES_REGISTRATION_SKIPPED: Readonly<Record<string, string>> = {
  "57005a.setup": "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/registration)",
  "57005b.enforce-the-law-constant":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/registration)",
  "57005b.enforce-the-law-constant-2":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/registration)",
  "57006b.mighty-avengers-constant":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/registration)",
};
