import { MOJO_CARDS, MOJO_ENCOUNTER_SETS, MOJO_PACK, MOJO_SCENARIOS, MOJO_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { CRIME_ABILITIES } from "./crime.js";
import { FANTASY_ABILITIES } from "./fantasy.js";
import { HORROR_ABILITIES } from "./horror.js";
import { LONGSHOT_ABILITIES } from "./longshot.js";
import { MAGOG_ABILITIES } from "./magog.js";
import { MOJO_SCENARIO_ABILITIES } from "./mojo.js";
import { SCI_FI_ABILITIES } from "./sci-fi.js";
import { SITCOM_ABILITIES } from "./sitcom.js";
import { SPIRAL_ABILITIES } from "./spiral.js";
import { WESTERN_ABILITIES } from "./western.js";

/**
 * The `mojo` product (MojoMania, MC39, docs/phase7-wave6.md §7) as a built-in pack: its cards and every script they
 * need, one module per encounter set: the six genre sets, the three scenarios' own sets and Longshot. Its kind is
 * `campaign` because the box has a three-scenario campaign (`../../campaigns/mojo.ts`), which adds rules, not cards.
 */
export const MOJO_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "mojo", kind: "campaign", name: MOJO_PACK.name, product: MOJO_PACK },
  cards: MOJO_CARDS,
  encounterSets: MOJO_ENCOUNTER_SETS,
  scenarios: MOJO_SCENARIOS,
  decks: MOJO_STARTER_DECKS,
  abilities: mergeRegistries(
    CRIME_ABILITIES,
    FANTASY_ABILITIES,
    HORROR_ABILITIES,
    SCI_FI_ABILITIES,
    SITCOM_ABILITIES,
    WESTERN_ABILITIES,
    MAGOG_ABILITIES,
    SPIRAL_ABILITIES,
    MOJO_SCENARIO_ABILITIES,
    LONGSHOT_ABILITIES,
  ),
});
