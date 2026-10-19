import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Superhero Resistance main scheme (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (1):
 * - 57044a Superhero Resistance (main_scheme)
 */
export const SYNTHEZOID_MAIN_SCHEMES_RESISTANCE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MAIN_SCHEMES_RESISTANCE_SKIPPED: Readonly<Record<string, string>> = {
  "57044a.setup": "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/resistance)",
  "57044b.protect-secret-identities-constant":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/resistance)",
  "57044b.protect-secret-identities-forced-response":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/resistance)",
  "57045b.expose-overreach-constant":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/main-schemes/resistance)",
};
