import { SPDR_CARDS, SPDR_ENCOUNTER_SETS, SPDR_PACK, SPDR_SCENARIOS, SPDR_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { SPDR_ALLIES } from "./allies.js";
import { SPDR_EVENTS } from "./events.js";
import { SPDR_IDENTITY } from "./identity.js";
import { SPDR_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { SPDR_SINISTER_SYNDICATE } from "./sinister-syndicate.js";
import { SPDR_SUPPORT_UPGRADES } from "./support-upgrades.js";

/**
 * The `spdr` product as a built-in pack: its cards and every script they need.
 *
 * The identity, events, allies, supports/upgrades, obligation/nemesis set and the Sinister Syndicate modular set, one
 * module each. See docs/phase7-wave5.md.
 */
export const SPDR_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "spdr", kind: "hero", name: SPDR_PACK.name, product: SPDR_PACK },
  cards: SPDR_CARDS,
  encounterSets: SPDR_ENCOUNTER_SETS,
  scenarios: SPDR_SCENARIOS,
  decks: SPDR_STARTER_DECKS,
  abilities: mergeRegistries(
    SPDR_IDENTITY,
    SPDR_EVENTS,
    SPDR_ALLIES,
    SPDR_SUPPORT_UPGRADES,
    SPDR_OBLIGATION_NEMESIS,
    SPDR_SINISTER_SYNDICATE,
  ),
});
