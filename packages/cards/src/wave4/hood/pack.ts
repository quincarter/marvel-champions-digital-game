import { HOOD_CARDS, HOOD_ENCOUNTER_SETS, HOOD_PACK, HOOD_SCENARIOS, HOOD_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../reprints.js";
import { BEASTY_BOYS } from "./beasty-boys.js";
import { BROTHERS_GRIMM } from "./brothers-grimm.js";
import { CROSSFIRE_CREW } from "./crossfire-crew.js";
import { HOOD } from "./hood.js";
import { RANSACKED_ARMORY } from "./ransacked-armory.js";
import { SINISTER_SYNDICATE } from "./sinister-syndicate.js";
import { WRECKING_CREW } from "./wrecking-crew.js";
import { MISTER_HYDE_SET } from "./mister-hyde.js";
import { STATE_OF_EMERGENCY } from "./state-of-emergency.js";
import { STREETS_OF_MAYHEM } from "./streets-of-mayhem.js";
import { STANDARD_EXPERT_II } from "./standard-expert-ii.js";

/**
 * The `hood` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * The villain, the main scheme and The Hood's own encounter set (`hood.ts`), then one file per modular set, and
 * Standard II / Expert II (`standard-expert-ii.ts`, the alternative difficulty sets). See docs/phase7-wave4.md §2.3
 * and §4 Q5.
 */
export const HOOD_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "hood", kind: "scenario", name: HOOD_PACK.name, product: HOOD_PACK },
  cards: HOOD_CARDS,
  encounterSets: HOOD_ENCOUNTER_SETS,
  scenarios: HOOD_SCENARIOS,
  decks: HOOD_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE4_REPRINT_ABILITIES, HOOD_CARDS),
    HOOD,
    BEASTY_BOYS,
    BROTHERS_GRIMM,
    CROSSFIRE_CREW,
    MISTER_HYDE_SET,
    STATE_OF_EMERGENCY,
    STREETS_OF_MAYHEM,
    RANSACKED_ARMORY,
    SINISTER_SYNDICATE,
    WRECKING_CREW,
    STANDARD_EXPERT_II,
  ),
});
