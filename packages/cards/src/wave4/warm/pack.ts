import { WARM_CARDS, WARM_ENCOUNTER_SETS, WARM_PACK, WARM_SCENARIOS, WARM_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../reprints.js";
import { WAR_MACHINE_KIT } from "./war-machine-kit.js";
import { WAR_MACHINE_OBLIGATION_NEMESIS } from "./war-machine-obligation-nemesis.js";
import { WAR_MACHINE_PACK_CARDS } from "./war-machine-pack-cards.js";

/**
 * The `warm` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * See docs/phase7-wave4.md.
 */
export const WARM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "warm", kind: "hero", name: WARM_PACK.name, product: WARM_PACK },
  cards: WARM_CARDS,
  encounterSets: WARM_ENCOUNTER_SETS,
  scenarios: WARM_SCENARIOS,
  decks: WARM_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE4_REPRINT_ABILITIES, WARM_CARDS),
    WAR_MACHINE_KIT,
    WAR_MACHINE_OBLIGATION_NEMESIS,
    WAR_MACHINE_PACK_CARDS,
  ),
});
