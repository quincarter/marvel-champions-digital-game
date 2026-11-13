import { WSP_CARDS, WSP_ENCOUNTER_SETS, WSP_PACK, WSP_SCENARIOS, WSP_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { WASP_KIT } from "./kit.js";
import { WASP_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { WSP_PACK_CARDS } from "./pack-cards.js";

/**
 * The `wsp` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): in progress.** Wasp's kit (`kit.ts`), obligation/nemesis
 * (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted; every remaining
 * ref is a documented, primitive-blocked skip (three-sided-identity/divided-power reuse of Ant-Man's own landed
 * primitives, plus new gaps found scripting this pack) — see the coverage test's `KNOWN_SKIPPED.wsp` and each module's
 * own docblock for the exact list and reasons.
 */
export const WSP_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "wsp", kind: "hero", name: WSP_PACK.name, product: WSP_PACK },
  cards: WSP_CARDS,
  encounterSets: WSP_ENCOUNTER_SETS,
  scenarios: WSP_SCENARIOS,
  decks: WSP_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE2_REPRINT_ABILITIES, WSP_CARDS),
    WASP_KIT,
    WASP_OBLIGATION_NEMESIS,
    WSP_PACK_CARDS,
  ),
});
