/**
 * The Core Set, defined as a built-in pack (`../builtin-packs/define.ts`). Adding a Core script is one line in the
 * ability list below, in the module of the hero, aspect, scenario or modular set it belongs to.
 */
import { CORE_CARDS, CORE_ENCOUNTER_SETS, CORE_PACK, CORE_SCENARIOS, CORE_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { AGGRESSION } from "./aspects/aggression.js";
import { BASIC } from "./aspects/basic.js";
import { JUSTICE } from "./aspects/justice.js";
import { LEADERSHIP } from "./aspects/leadership.js";
import { PROTECTION } from "./aspects/protection.js";
import { BLACK_PANTHER_KIT, BLACK_PANTHER_NEMESIS, BLACK_PANTHER_OBLIGATION } from "./heroes/black-panther.js";
import { CAPTAIN_MARVEL_KIT, CAPTAIN_MARVEL_NEMESIS, CAPTAIN_MARVEL_OBLIGATION } from "./heroes/captain-marvel.js";
import { IRON_MAN_KIT, IRON_MAN_NEMESIS, IRON_MAN_OBLIGATION } from "./heroes/iron-man.js";
import { SHE_HULK_KIT, SHE_HULK_NEMESIS, SHE_HULK_OBLIGATION } from "./heroes/she-hulk.js";
import { SPIDER_MAN_KIT, SPIDER_MAN_NEMESIS, SPIDER_MAN_OBLIGATION } from "./heroes/spider-man.js";
import { BOMB_SCARE_SET } from "./modular/bomb-scare.js";
import { DOOMSDAY_CHAIR_SET, LEGIONS_OF_HYDRA_SET } from "./modular/hydra-and-doomsday.js";
import { EXPERT_SET, STANDARD_SET } from "./modular/standard.js";
import { KLAW, MASTERS_OF_EVIL_SET } from "./scenarios/klaw.js";
import { RHINO } from "./scenarios/rhino.js";
import { ULTRON, UNDER_ATTACK_SET } from "./scenarios/ultron.js";

/** The Core Set as a built-in pack: its cards, sets, scenarios, precons and every scripted ability. */
export const CORE_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "core", kind: "core", name: CORE_PACK.name, product: CORE_PACK },
  cards: CORE_CARDS,
  encounterSets: CORE_ENCOUNTER_SETS,
  scenarios: CORE_SCENARIOS,
  decks: CORE_STARTER_DECKS,
  abilities: mergeRegistries(
    // Heroes: kit, obligation, nemesis set.
    SPIDER_MAN_KIT,
    SPIDER_MAN_OBLIGATION,
    SPIDER_MAN_NEMESIS,
    CAPTAIN_MARVEL_KIT,
    CAPTAIN_MARVEL_OBLIGATION,
    CAPTAIN_MARVEL_NEMESIS,
    SHE_HULK_KIT,
    SHE_HULK_OBLIGATION,
    SHE_HULK_NEMESIS,
    IRON_MAN_KIT,
    IRON_MAN_OBLIGATION,
    IRON_MAN_NEMESIS,
    BLACK_PANTHER_KIT,
    BLACK_PANTHER_OBLIGATION,
    BLACK_PANTHER_NEMESIS,
    // Aspects and basics.
    AGGRESSION,
    JUSTICE,
    LEADERSHIP,
    PROTECTION,
    BASIC,
    // Scenarios and modular sets.
    RHINO,
    KLAW,
    ULTRON,
    BOMB_SCARE_SET,
    MASTERS_OF_EVIL_SET,
    UNDER_ATTACK_SET,
    LEGIONS_OF_HYDRA_SET,
    DOOMSDAY_CHAIR_SET,
    STANDARD_SET,
    EXPERT_SET,
  ),
});
