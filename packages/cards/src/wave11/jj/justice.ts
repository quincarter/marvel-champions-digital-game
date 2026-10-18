import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";

/**
 * Wave 11 scripting module `jj/justice` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (11):
 * - 61015 Captain Marvel (ally)
 * - 61016 Spider-Woman (ally)
 * - 61017 Squirrel Girl (ally)
 * - 61018 Lay Down the Law (event)
 * - 61019 Strategy Session (event)
 * - 61020 Run Them to Ground (player_side_scheme)
 * - 61021 Lay the Trap (player_side_scheme)
 * - 61022 Determination (resource)
 * - 61023 Grapnel Launcher (upgrade)
 * - 61024 Entrapment (upgrade)
 * - 61036 Innate Perception (upgrade)
 *
 * Reprints, aliased to the original script (the wave 10 `hercules/basic` precedent): 61018 (12031), 61021 (41016),
 * 61022 (21052). The test checks the printed text matches.
 *
 * Scaffold (HS0): only the reprint aliases are registered; every other ref is in `JJ_JUSTICE_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `justice.test.ts`.
 */
export const JJ_JUSTICE: AbilityRegistry = defineAbilities({
  "61018.lay-down-the-law-response": WAVE10_ABILITIES["12031.lay-down-the-law-response"]!,
  "61021.when-defeated": WAVE10_ABILITIES["41016.when-defeated"]!,
  "61022.determination-response": WAVE10_ABILITIES["21052.determination-response"]!,
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {
  "61015.captain-marvel-response": "wave 11 scripting in progress: jj/justice",
  "61016.spider-woman-response": "wave 11 scripting in progress: jj/justice",
  "61017.squirrel-girl-response": "wave 11 scripting in progress: jj/justice",
  "61017.squirrel-girl-action": "wave 11 scripting in progress: jj/justice",
  "61019.strategy-session-action": "wave 11 scripting in progress: jj/justice",
  "61019.strategy-session-hero-action": "wave 11 scripting in progress: jj/justice",
  "61020.when-defeated": "wave 11 scripting in progress: jj/justice",
  "61023.grapnel-launcher-action": "wave 11 scripting in progress: jj/justice",
  "61024.entrapment-response": "wave 11 scripting in progress: jj/justice",
  "61036.innate-perception-constant": "wave 11 scripting in progress: jj/justice",
};
