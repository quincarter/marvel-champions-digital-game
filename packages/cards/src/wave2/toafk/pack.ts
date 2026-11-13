import { TOAFK_CARDS, TOAFK_ENCOUNTER_SETS, TOAFK_PACK, TOAFK_SCENARIOS, TOAFK_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { KANG_SET } from "./kang.js";
import { KANG_ENCOUNTER_SET } from "./kang-encounter-set.js";

/**
 * The `toafk` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): in progress.** Kang's villain (standard and expert), "Kang's
 * Arrival" 1A/1B, "The Master of Time" 2A (2B pinned — module docblock), all four stage 3 alternatives, and the
 * Kang/Temporal encounter sets (11014–11033, minus the four Temporal obligations) are scripted; stage 4 ("Kang's
 * Wrath") and the Expert encounter set (11040–11051) are not started yet — see the coverage test's
 * `KNOWN_SKIPPED.toafk` for the exact remaining ids.
 */
export const TOAFK_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "toafk", kind: "scenario", name: TOAFK_PACK.name, product: TOAFK_PACK },
  cards: TOAFK_CARDS,
  encounterSets: TOAFK_ENCOUNTER_SETS,
  scenarios: TOAFK_SCENARIOS,
  decks: TOAFK_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, TOAFK_CARDS), KANG_SET, KANG_ENCOUNTER_SET),
});
