import { THOR_CARDS, THOR_ENCOUNTER_SETS, THOR_PACK, THOR_SCENARIOS, THOR_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { THOR_KIT } from "./kit.js";
import { THOR_NEMESIS } from "./nemesis.js";
import { THOR_OBLIGATION } from "./obligation.js";
import { THOR_PACK_CARDS } from "./pack-cards.js";

/**
 * The `thor` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 *
 * Every ability ref for this pack now resolves — 0 skips.
 *
 * Valkyrie's Response (06012.valkyrie-response) was a skip until the 2026-09-15 engine fix threaded a card's own
 * `paid.*` vars into a Response triggered by that same card's `cardEntersPlay`. Mean Swing (06015) was a skip until
 * the wave B primitives batch landed `TargetQuery.host` ("a Weapon upgrade on your hero"); both are scripted now
 * (`pack-cards.ts`).
 */
export const THOR_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "thor", kind: "hero", name: THOR_PACK.name, product: THOR_PACK },
  cards: THOR_CARDS,
  encounterSets: THOR_ENCOUNTER_SETS,
  scenarios: THOR_SCENARIOS,
  decks: THOR_STARTER_DECKS,
  abilities: mergeRegistries(
    wave1ReprintAbilitiesOf(THOR_CARDS),
    THOR_KIT,
    THOR_OBLIGATION,
    THOR_NEMESIS,
    THOR_PACK_CARDS,
  ),
});
