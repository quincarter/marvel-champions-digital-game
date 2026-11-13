import { VNM_CARDS, VNM_ENCOUNTER_SETS, VNM_PACK, VNM_SCENARIOS, VNM_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { VENOM_KIT } from "./venom-kit.js";
import { VENOM_OBLIGATION_NEMESIS } from "./venom-obligation-nemesis.js";

/**
 * The `vnm` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * Venom / Flash Thompson (`vnm`), wave 3 (cycle 2). Kit (20001–20022, 20026–20029), obligation and nemesis set
 * (Struggle for Control 20023, Klyntar Frenzy 20024, Enraged Symbiote 20025).
 */
export const VNM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "vnm", kind: "hero", name: VNM_PACK.name, product: VNM_PACK },
  cards: VNM_CARDS,
  encounterSets: VNM_ENCOUNTER_SETS,
  scenarios: VNM_SCENARIOS,
  decks: VNM_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE3_REPRINT_ABILITIES, VNM_CARDS),
    VENOM_KIT,
    VENOM_OBLIGATION_NEMESIS,
  ),
});
