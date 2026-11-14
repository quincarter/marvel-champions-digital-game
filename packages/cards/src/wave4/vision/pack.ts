import { VISION_CARDS, VISION_ENCOUNTER_SETS, VISION_PACK, VISION_SCENARIOS, VISION_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../reprints.js";
import { VISION_KIT } from "./vision-kit.js";
import { VISION_OBLIGATION_NEMESIS } from "./vision-obligation-nemesis.js";
import { VISION_PACK_CARDS } from "./vision-pack-cards.js";

/**
 * The `vision` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * Its reprints (Indomitable, Side Step, Get Behind Me!, Avengers Mansion, Ultron Drones) come from `../reprints.ts`.
 * See docs/phase7-wave4.md.
 */
export const VISION_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "vision", kind: "hero", name: VISION_PACK.name, product: VISION_PACK },
  cards: VISION_CARDS,
  encounterSets: VISION_ENCOUNTER_SETS,
  scenarios: VISION_SCENARIOS,
  decks: VISION_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE4_REPRINT_ABILITIES, VISION_CARDS),
    VISION_KIT,
    VISION_OBLIGATION_NEMESIS,
    VISION_PACK_CARDS,
  ),
});
