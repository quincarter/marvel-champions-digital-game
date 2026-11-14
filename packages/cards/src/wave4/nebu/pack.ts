import { NEBU_CARDS, NEBU_ENCOUNTER_SETS, NEBU_PACK, NEBU_SCENARIOS, NEBU_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../reprints.js";
import { NEBULA_KIT } from "./nebula-kit.js";
import { NEBULA_OBLIGATION_NEMESIS } from "./nebula-obligation-nemesis.js";
import { NEBULA_PACK_CARDS } from "./nebula-pack-cards.js";

/**
 * The `nebu` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * See docs/phase7-wave4.md.
 */
export const NEBU_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "nebu", kind: "hero", name: NEBU_PACK.name, product: NEBU_PACK },
  cards: NEBU_CARDS,
  encounterSets: NEBU_ENCOUNTER_SETS,
  scenarios: NEBU_SCENARIOS,
  decks: NEBU_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE4_REPRINT_ABILITIES, NEBU_CARDS),
    NEBULA_KIT,
    NEBULA_OBLIGATION_NEMESIS,
    NEBULA_PACK_CARDS,
  ),
});
