import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { KANG_SET } from "./kang.js";
import { KANG_ENCOUNTER_SET } from "./kang-encounter-set.js";

/**
 * Every The Once and Future Kang (`toafk`) ability scripted directly (i.e. not a reprint aliased by
 * `../reprints.ts`). This is the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave2-scripting.md`.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): in progress.** Kang's villain (standard and expert),
 * "Kang's Arrival" 1A/1B, "The Master of Time" 2A (2B pinned — module docblock), all four stage 3 alternatives,
 * and the Kang/Temporal encounter sets (11014–11033, minus the four Temporal obligations) are scripted; stage 4
 * ("Kang's Wrath") and the Expert encounter set (11040–11051) are not started yet — see the coverage test's
 * `KNOWN_SKIPPED.toafk` for the exact remaining ids.
 */
export const TOAFK_ABILITIES: AbilityRegistry = mergeRegistries(KANG_SET, KANG_ENCOUNTER_SET);
