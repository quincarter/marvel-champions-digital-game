import { GMW_CARDS, GMW_ENCOUNTER_SETS, GMW_PACK, GMW_SCENARIOS, GMW_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { BADOON } from "./badoon.js";
import { BADOON_HEADHUNTER } from "./badoon-headhunter.js";
import { CAMPAIGN_CHALLENGE } from "./campaign-challenge.js";
import { ESCAPE_THE_MUSEUM } from "./escape-the-museum.js";
import { GALACTIC_ARTIFACTS } from "./galactic-artifacts.js";
import { GROOT_KIT } from "./groot-kit.js";
import { GROOT_OBLIGATION_NEMESIS } from "./groot-obligation-nemesis.js";
import { MARKET } from "./market.js";
import { MUSEUM } from "./museum.js";
import { NEBULA } from "./nebula.js";
import { ROCKET_KIT } from "./rocket-kit.js";
import { ROCKET_OBLIGATION_NEMESIS } from "./rocket-obligation-nemesis.js";
import { RONAN } from "./ronan.js";
import { RUTHLESS } from "./ruthless.js";
import { SHIP_COMMAND } from "./ship-command.js";

/**
 * The `gmw` product as a built-in pack: its cards and every script they need, reprint aliases included.
 *
 * See docs/phase7-wave3-scripting.md.
 */
export const GMW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gmw", kind: "campaign", name: GMW_PACK.name, product: GMW_PACK },
  cards: GMW_CARDS,
  encounterSets: GMW_ENCOUNTER_SETS,
  scenarios: GMW_SCENARIOS,
  decks: GMW_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE3_REPRINT_ABILITIES, GMW_CARDS),
    GROOT_KIT,
    GROOT_OBLIGATION_NEMESIS,
    ROCKET_KIT,
    ROCKET_OBLIGATION_NEMESIS,
    SHIP_COMMAND,
    BADOON,
    MUSEUM,
    ESCAPE_THE_MUSEUM,
    NEBULA,
    RONAN,
    RUTHLESS,
    GALACTIC_ARTIFACTS,
    BADOON_HEADHUNTER,
    MARKET,
    CAMPAIGN_CHALLENGE,
  ),
});
