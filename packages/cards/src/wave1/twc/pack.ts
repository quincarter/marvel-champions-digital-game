import { TWC_CARDS, TWC_ENCOUNTER_SETS, TWC_PACK, TWC_SCENARIOS, TWC_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { BREAKOUT } from "./breakout.js";
import { BULLDOZER_SET } from "./bulldozer.js";
import { PILEDRIVER_SET } from "./piledriver.js";
import { THUNDERBALL_SET } from "./thunderball.js";
import { WRECKER_SET } from "./wrecker.js";

/**
 * The `twc` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 *
 * Merged with `mergeRegistries`, never an object spread: a spread silently hides a duplicate id
 * (`docs/phase7-wave1-scripting.md`).
 */
export const TWC_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "twc", kind: "scenario", name: TWC_PACK.name, product: TWC_PACK },
  cards: TWC_CARDS,
  encounterSets: TWC_ENCOUNTER_SETS,
  scenarios: TWC_SCENARIOS,
  decks: TWC_STARTER_DECKS,
  abilities: mergeRegistries(
    wave1ReprintAbilitiesOf(TWC_CARDS),
    BREAKOUT,
    WRECKER_SET,
    THUNDERBALL_SET,
    PILEDRIVER_SET,
    BULLDOZER_SET,
  ),
});
