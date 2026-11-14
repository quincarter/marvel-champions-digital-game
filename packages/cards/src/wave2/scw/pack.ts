import { SCW_CARDS, SCW_ENCOUNTER_SETS, SCW_PACK, SCW_SCENARIOS, SCW_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { SCW_KIT } from "./kit.js";
import { SCW_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { SCW_PACK_CARDS } from "./pack-cards.js";

/**
 * The `scw` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): fully scripted, `KNOWN_SKIPPED.scw` empty.** Scarlet Witch's
 * kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards
 * (`pack-cards.ts`) are scripted; `15023.obligation` (Slipping Sanity) landed once `card-data-pipeline` added a printed
 * `starIcon` field — see `obligation-nemesis.ts`'s own docblock.
 */
export const SCW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "scw", kind: "hero", name: SCW_PACK.name, product: SCW_PACK },
  cards: SCW_CARDS,
  encounterSets: SCW_ENCOUNTER_SETS,
  scenarios: SCW_SCENARIOS,
  decks: SCW_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE2_REPRINT_ABILITIES, SCW_CARDS),
    SCW_KIT,
    SCW_OBLIGATION_NEMESIS,
    SCW_PACK_CARDS,
  ),
});
