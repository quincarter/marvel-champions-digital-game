import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Vision leader set (`vision_leader`, Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (10):
 * - 57040 Vision (villain)
 * - 57046a Dense (attachment)
 * - 57047 Solar Gem (attachment)
 * - 57048 Vision's Cape (attachment)
 * - 57049 Mass Increase (attachment)
 * - 57050 Density Control (attachment)
 * - 57051 Solar Beam (treachery)
 * - 57052 Superdense Strike (treachery)
 * - 57053 Phase Disruption (treachery)
 * - 57054 Just Passing Through (side_scheme)
 */
export const SYNTHEZOID_LEADERS_VISION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_LEADERS_VISION_SKIPPED: Readonly<Record<string, string>> = {
  "57040.setup": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57040.vision-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57041.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57041.vision-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57042.setup": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57042.vision-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57043.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57043.vision-forced-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57046b.intangible-forced-interrupt": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57047.solar-gem-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57047.solar-gem-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57047.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57048.visions-cape-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57048.visions-cape-response": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57048.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57049.mass-increase-forced-interrupt": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57050.density-control-forced-interrupt": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57050.density-control-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57051.when-revealed-alter-ego": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57051.when-revealed-hero": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57052.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57053.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
  "57054.when-defeated": "wave 11 PR: synthezoid scripting in progress (synthezoid/leaders/vision)",
};
