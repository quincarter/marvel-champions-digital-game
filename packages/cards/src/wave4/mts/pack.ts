import { MTS_CARDS, MTS_ENCOUNTER_SETS, MTS_PACK, MTS_SCENARIOS, MTS_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../reprints.js";
import { ADAM_WARLOCK_KIT } from "./adam-warlock-kit.js";
import { ADAM_WARLOCK_OBLIGATION_NEMESIS } from "./adam-warlock-obligation-nemesis.js";
import { ADAM_WARLOCK_PACK_CARDS } from "./adam-warlock-pack-cards.js";
import { CHILDREN_OF_THANOS } from "./children-of-thanos.js";
import { EBONY_MAW } from "./ebony-maw.js";
import { ENCHANTRESS } from "./enchantress.js";
import { FROST_GIANTS } from "./frost-giants.js";
import { HELA } from "./hela.js";
import { INFINITY_GAUNTLET } from "./infinity-gauntlet.js";
import { LEGIONS_OF_HEL } from "./legions-of-hel.js";
import { LOKI } from "./loki.js";
import { MTS_CAMPAIGN_CARDS } from "./mts-campaign-cards.js";
import { SPECTRUM_KIT } from "./spectrum-kit.js";
import { SPECTRUM_OBLIGATION_NEMESIS } from "./spectrum-obligation-nemesis.js";
import { SPECTRUM_PACK_CARDS } from "./spectrum-pack-cards.js";
import { THANOS } from "./thanos.js";
import { TOWER_DEFENSE } from "./tower-defense.js";

/**
 * The `mts` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * Spectrum and Adam Warlock (both heroes scripted), then the box's five scenarios: Ebony Maw (`ebony-maw.ts`),
 * Tower Defense (`tower-defense.ts`), Thanos (`thanos.ts`, with its own Infinity Gauntlet modular set,
 * `infinity-gauntlet.ts`, and Children of Thanos, `children-of-thanos.ts`), Hela (`hela.ts`, with the two modular
 * sets it recommends, `legions-of-hel.ts` and `frost-giants.ts`, the latter reused by Loki) and Loki (`loki.ts`, with
 * its other recommended modular, Enchantress, `enchantress.ts`), then the box's campaign material
 * (`mts-campaign-cards.ts`; see `KNOWN_SKIPPED.mts` in `../coverage.test.ts`). See docs/phase7-wave4.md.
 */
export const MTS_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "mts", kind: "campaign", name: MTS_PACK.name, product: MTS_PACK },
  cards: MTS_CARDS,
  encounterSets: MTS_ENCOUNTER_SETS,
  scenarios: MTS_SCENARIOS,
  decks: MTS_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE4_REPRINT_ABILITIES, MTS_CARDS),
    SPECTRUM_KIT,
    SPECTRUM_PACK_CARDS,
    SPECTRUM_OBLIGATION_NEMESIS,
    ADAM_WARLOCK_KIT,
    ADAM_WARLOCK_PACK_CARDS,
    ADAM_WARLOCK_OBLIGATION_NEMESIS,
    EBONY_MAW,
    TOWER_DEFENSE,
    THANOS,
    INFINITY_GAUNTLET,
    CHILDREN_OF_THANOS,
    HELA,
    LEGIONS_OF_HEL,
    FROST_GIANTS,
    ENCHANTRESS,
    LOKI,
    MTS_CAMPAIGN_CARDS,
  ),
});
