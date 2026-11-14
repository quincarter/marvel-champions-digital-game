import { VALK_CARDS, VALK_ENCOUNTER_SETS, VALK_PACK, VALK_SCENARIOS, VALK_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../reprints.js";
import { VALKYRIE_KIT } from "./valkyrie-kit.js";
import { VALKYRIE_OBLIGATION_NEMESIS } from "./valkyrie-obligation-nemesis.js";
import { VALKYRIE_PACK_CARDS } from "./valkyrie-pack-cards.js";

/**
 * The `valk` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * See docs/phase7-wave4.md §3.22.
 */
export const VALK_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "valk", kind: "hero", name: VALK_PACK.name, product: VALK_PACK },
  cards: VALK_CARDS,
  encounterSets: VALK_ENCOUNTER_SETS,
  scenarios: VALK_SCENARIOS,
  decks: VALK_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE4_REPRINT_ABILITIES, VALK_CARDS),
    VALKYRIE_KIT,
    VALKYRIE_OBLIGATION_NEMESIS,
    VALKYRIE_PACK_CARDS,
  ),
});
