import { HLK_CARDS, HLK_ENCOUNTER_SETS, HLK_PACK, HLK_SCENARIOS, HLK_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { HLK_KIT } from "./kit.js";
import { HLK_NEMESIS } from "./nemesis.js";
import { HLK_OBLIGATION } from "./obligation.js";
import { HLK_PACK_CARDS } from "./pack-cards.js";

/**
 * The `hlk` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 *
 * One ability is still skipped — a missing primitive, recorded precisely beside where it would go:
 * - Beat Cop's second ability (10029, "Action: Exhaust and discard Beat Cop → deal 1 damage to a minion for each
 *   threat here") — `pack-cards.ts`.
 *
 * Hulk Smash (10003) was a skip for the same reason until the 2026-09-15 engine fix landed (see `kit.ts`); it's
 * scripted there now. Every other `hlk` ability with printed text is scripted here.
 */
export const HLK_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "hlk", kind: "hero", name: HLK_PACK.name, product: HLK_PACK },
  cards: HLK_CARDS,
  encounterSets: HLK_ENCOUNTER_SETS,
  scenarios: HLK_SCENARIOS,
  decks: HLK_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(HLK_CARDS), HLK_KIT, HLK_OBLIGATION, HLK_NEMESIS, HLK_PACK_CARDS),
});
