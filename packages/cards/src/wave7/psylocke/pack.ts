import {
  PSYLOCKE_CARDS,
  PSYLOCKE_ENCOUNTER_SETS,
  PSYLOCKE_PACK,
  PSYLOCKE_SCENARIOS,
  PSYLOCKE_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { PSYLOCKE_EVENTS } from "./events.js";
import { PSYLOCKE_IDENTITY } from "./identity.js";
import { PSYLOCKE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { PSYLOCKE_PACK_CARDS } from "./pack-cards.js";
import { PSYLOCKE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * The `psylocke` product as a built-in pack: its cards and every script they need, one module per card group (identity,
 * events, supports/upgrades/allies, obligation and nemesis set, the pack's other cards).
 */
export const PSYLOCKE_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "psylocke", kind: "hero", name: PSYLOCKE_PACK.name, product: PSYLOCKE_PACK },
  cards: PSYLOCKE_CARDS,
  encounterSets: PSYLOCKE_ENCOUNTER_SETS,
  scenarios: PSYLOCKE_SCENARIOS,
  decks: PSYLOCKE_STARTER_DECKS,
  abilities: mergeRegistries(
    PSYLOCKE_IDENTITY,
    PSYLOCKE_EVENTS,
    PSYLOCKE_SUPPORT_UPGRADES_ALLIES,
    PSYLOCKE_OBLIGATION_NEMESIS,
    PSYLOCKE_PACK_CARDS,
  ),
});
