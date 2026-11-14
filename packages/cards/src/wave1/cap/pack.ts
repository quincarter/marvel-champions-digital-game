import { CAP_CARDS, CAP_ENCOUNTER_SETS, CAP_PACK, CAP_SCENARIOS, CAP_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { CAP_KIT } from "./kit.js";
import { CAP_NEMESIS } from "./nemesis.js";
import { CAP_OBLIGATION } from "./obligation.js";
import { CAP_PACK_CARDS } from "./pack-cards.js";

/**
 * The `cap` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 */
export const CAP_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "cap", kind: "hero", name: CAP_PACK.name, product: CAP_PACK },
  cards: CAP_CARDS,
  encounterSets: CAP_ENCOUNTER_SETS,
  scenarios: CAP_SCENARIOS,
  decks: CAP_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(CAP_CARDS), CAP_KIT, CAP_OBLIGATION, CAP_NEMESIS, CAP_PACK_CARDS),
});
