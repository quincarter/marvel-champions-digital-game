import { FALCON_CARDS, FALCON_ENCOUNTER_SETS, FALCON_PACK, FALCON_SCENARIOS, FALCON_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { FALCON_ASPECT_BASIC } from "./aspect-basic.js";
import { FALCON_EVENTS } from "./falcon/events.js";
import { FALCON_IDENTITY } from "./falcon/identity.js";
import { FALCON_OBLIGATION_NEMESIS } from "./falcon/obligation-nemesis.js";
import { FALCON_SUPPORT_UPGRADES_ALLIES } from "./falcon/support-upgrades-allies.js";
import { TECHNO } from "./techno.js";

/**
 * The `falcon` product as a built-in pack: its cards and every script they need.
 *
 * The Falcon hero pack (with the Techno modular set), scripted from per-group modules. See docs/phase7-wave9.md.
 */
export const FALCON_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "falcon", kind: "hero", name: FALCON_PACK.name, product: FALCON_PACK },
  cards: FALCON_CARDS,
  encounterSets: FALCON_ENCOUNTER_SETS,
  scenarios: FALCON_SCENARIOS,
  decks: FALCON_STARTER_DECKS,
  abilities: mergeRegistries(
    FALCON_ASPECT_BASIC,
    FALCON_EVENTS,
    FALCON_IDENTITY,
    FALCON_OBLIGATION_NEMESIS,
    FALCON_SUPPORT_UPGRADES_ALLIES,
    TECHNO,
  ),
});
