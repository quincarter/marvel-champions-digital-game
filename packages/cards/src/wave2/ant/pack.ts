import { ANT_CARDS, ANT_ENCOUNTER_SETS, ANT_PACK, ANT_SCENARIOS, ANT_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { ANT_MAN_KIT } from "./kit.js";
import { ANT_MAN_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { ANT_PACK_CARDS } from "./pack-cards.js";

/**
 * The `ant` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): scripted.** Ant-Man's kit (`kit.ts`), obligation/nemesis
 * (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted; every remaining
 * ref is a documented, primitive-blocked (or, for Yellowjacket's two form-conditional constants, a found-by-testing
 * engine-crash) skip — see the coverage test's `KNOWN_SKIPPED.ant` and each module's own docblock for the exact list
 * and reasons.
 */
export const ANT_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "ant", kind: "hero", name: ANT_PACK.name, product: ANT_PACK },
  cards: ANT_CARDS,
  encounterSets: ANT_ENCOUNTER_SETS,
  scenarios: ANT_SCENARIOS,
  decks: ANT_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE2_REPRINT_ABILITIES, ANT_CARDS),
    ANT_MAN_KIT,
    ANT_MAN_OBLIGATION_NEMESIS,
    ANT_PACK_CARDS,
  ),
});
