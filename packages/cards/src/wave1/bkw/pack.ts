import { BKW_CARDS, BKW_ENCOUNTER_SETS, BKW_PACK, BKW_SCENARIOS, BKW_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { BKW_KIT } from "./kit.js";
import { BKW_NEMESIS } from "./nemesis.js";
import { BKW_OBLIGATION } from "./obligation.js";
import { BKW_PACK_CARDS } from "./pack-cards.js";

/**
 * The `bkw` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 *
 * Every ability ref for this pack now resolves — 0 skips.
 *
 * Taskmaster's Boost (08026.boost, `nemesis.ts`) was a skip until the wave B primitives batch confirmed it needs no
 * new engine primitive: `modifyStat(stat, n, theVillain, "endOfAttack")` already says "for this activation, the
 * villain gets +N" regardless of which enemy is actually activating.
 */
export const BKW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "bkw", kind: "hero", name: BKW_PACK.name, product: BKW_PACK },
  cards: BKW_CARDS,
  encounterSets: BKW_ENCOUNTER_SETS,
  scenarios: BKW_SCENARIOS,
  decks: BKW_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(BKW_CARDS), BKW_KIT, BKW_OBLIGATION, BKW_NEMESIS, BKW_PACK_CARDS),
});
