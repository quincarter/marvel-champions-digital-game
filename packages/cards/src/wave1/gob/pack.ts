import { GOB_CARDS, GOB_ENCOUNTER_SETS, GOB_PACK, GOB_SCENARIOS, GOB_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { A_MESS_OF_THINGS } from "./a-mess-of-things.js";
import { GOBLIN_GIMMICKS } from "./goblin-gimmicks.js";
import { MUTAGEN_FORMULA } from "./mutagen-formula.js";
import { POWER_DRAIN } from "./power-drain.js";
import { RISKY_BUSINESS } from "./risky-business.js";
import { RUNNING_INTERFERENCE } from "./running-interference.js";

/**
 * The `gob` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 *
 * One ability ref is not included, recorded beside it (`power-drain.ts`'s doc comment): `02041.when-defeated` (Power
 * Drain) needs a per-player hand discard with both a live count and a resource-type filter, which no existing
 * primitive combines.
 */
export const GOB_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gob", kind: "scenario", name: GOB_PACK.name, product: GOB_PACK },
  cards: GOB_CARDS,
  encounterSets: GOB_ENCOUNTER_SETS,
  scenarios: GOB_SCENARIOS,
  decks: GOB_STARTER_DECKS,
  abilities: mergeRegistries(
    wave1ReprintAbilitiesOf(GOB_CARDS),
    RISKY_BUSINESS,
    MUTAGEN_FORMULA,
    GOBLIN_GIMMICKS,
    A_MESS_OF_THINGS,
    POWER_DRAIN,
    RUNNING_INTERFERENCE,
  ),
});
