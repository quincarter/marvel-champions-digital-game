import { QSV_CARDS, QSV_ENCOUNTER_SETS, QSV_PACK, QSV_SCENARIOS, QSV_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { QSV_KIT } from "./kit.js";
import { QUICKSILVER_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { QSV_PACK_CARDS } from "./pack-cards.js";

/**
 * The `qsv` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): scripted.** Quicksilver's kit (`kit.ts`), obligation/nemesis
 * (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted; every remaining
 * ref is a documented, primitive- or data-blocked skip — see the coverage test's `KNOWN_SKIPPED.qsv` and each module's
 * own docblock for the exact list and reasons.
 */
export const QSV_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "qsv", kind: "hero", name: QSV_PACK.name, product: QSV_PACK },
  cards: QSV_CARDS,
  encounterSets: QSV_ENCOUNTER_SETS,
  scenarios: QSV_SCENARIOS,
  decks: QSV_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE2_REPRINT_ABILITIES, QSV_CARDS),
    QSV_KIT,
    QUICKSILVER_OBLIGATION_NEMESIS,
    QSV_PACK_CARDS,
  ),
});
