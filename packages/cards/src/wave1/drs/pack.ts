import { DRS_CARDS, DRS_ENCOUNTER_SETS, DRS_PACK, DRS_SCENARIOS, DRS_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { DRS_KIT } from "./kit.js";
import { DRS_NEMESIS } from "./nemesis.js";
import { DRS_OBLIGATION } from "./obligation.js";
import { DRS_PACK_CARDS } from "./pack-cards.js";

/**
 * The `drs` product as a built-in pack: its cards and every script they need, Core reprint aliases included.
 *
 * Every `drs` ability ref with printed text is scripted somewhere in this pack — 0 skips. In order fixed/landed:
 * Desperate Defense (09015) was a skip for a confirmed engine bug (`isAnnouncement` never let an Interrupt fire on
 * `on.defends`) until the 2026-09-15 fix landed; it's scripted in `pack-cards.ts`. Unflappable (09020), Vapors of
 * Valtorr (09035), Physical Toll (09027) and Counterspell (09030) were all skips for missing primitives until the wave
 * B primitives batch (docs/phase7-wave1-scripting.md §6) landed `EventPattern.resultsAtMost`,
 * `TargetQuery.hasAnyStatus`, `increaseNextCardCost(..., "untilPlayed", ...)`/`afterNextCardPlayed`, and the
 * `play-card.ts` fix letting a cancelled play stop its own effects, respectively; they're scripted in `pack-cards.ts`,
 * `kit.ts`, `obligation.ts` and `nemesis.ts`.
 */
export const DRS_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "drs", kind: "hero", name: DRS_PACK.name, product: DRS_PACK },
  cards: DRS_CARDS,
  encounterSets: DRS_ENCOUNTER_SETS,
  scenarios: DRS_SCENARIOS,
  decks: DRS_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(DRS_CARDS), DRS_KIT, DRS_OBLIGATION, DRS_NEMESIS, DRS_PACK_CARDS),
});
