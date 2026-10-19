import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * She-Hulk leader set (`she_hulk_leader`, Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (7):
 * - 57001 She-Hulk (villain)
 * - 57007 Superhuman Strength (attachment)
 * - 57008 Focused Rage (attachment)
 * - 57009 One-Two Punch (treachery)
 * - 57010 Ground Stomp (treachery)
 * - 57011 Gamma Slam (treachery)
 * - 57012 Legal Practice (side_scheme)
 */
export const SYNTHEZOID_LEADERS_SHE_HULK: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_LEADERS_SHE_HULK_SKIPPED: Readonly<Record<string, string>> = {
  "57001.setup": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57001.she-hulk-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57002.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57002.she-hulk-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57003.setup": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57003.she-hulk-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57004.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57004.she-hulk-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57007.superhuman-strength-forced-interrupt":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57007.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57008.focused-rage-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57008.focused-rage-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57008.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57009.when-revealed-alter-ego": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57009.when-revealed-hero": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57010.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57010.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57011.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57012.legal-practice-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
  "57012.legal-practice-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/she-hulk)",
};
