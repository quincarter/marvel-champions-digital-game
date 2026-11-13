import { MSM_CARDS, MSM_ENCOUNTER_SETS, MSM_PACK, MSM_SCENARIOS, MSM_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { MSM_ABILITIES } from "./index.js";

/** The `msm` product as a built-in pack: its cards and every script they need, Core reprint aliases included. */
export const MSM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "msm", kind: "hero", name: MSM_PACK.name, product: MSM_PACK },
  cards: MSM_CARDS,
  encounterSets: MSM_ENCOUNTER_SETS,
  scenarios: MSM_SCENARIOS,
  decks: MSM_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(MSM_CARDS), MSM_ABILITIES),
});
