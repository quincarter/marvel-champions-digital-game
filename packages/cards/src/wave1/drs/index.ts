import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { DRS_KIT } from "./kit.js";
import { DRS_NEMESIS } from "./nemesis.js";
import { DRS_OBLIGATION } from "./obligation.js";
import { DRS_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Doctor Strange (`drs`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`).
 * This is the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`.
 *
 * Every `drs` ability ref with printed text is scripted somewhere in this pack — 0 skips. In order fixed/landed:
 * Desperate Defense (09015) was a skip for a confirmed engine bug (`isAnnouncement` never let an Interrupt fire on
 * `on.defends`) until the 2026-09-15 fix landed; it's scripted in `pack-cards.ts`. Unflappable (09020), Vapors of
 * Valtorr (09035), Physical Toll (09027) and Counterspell (09030) were all skips for missing primitives until the
 * wave B primitives batch (docs/phase7-wave1-scripting.md §6) landed `EventPattern.resultsAtMost`,
 * `TargetQuery.hasAnyStatus`, `increaseNextCardCost(..., "untilPlayed", ...)`/`afterNextCardPlayed`, and the
 * `play-card.ts` fix letting a cancelled play stop its own effects, respectively; they're scripted in
 * `pack-cards.ts`, `kit.ts`, `obligation.ts` and `nemesis.ts`.
 */
export const DRS_ABILITIES: AbilityRegistry = mergeRegistries(DRS_KIT, DRS_OBLIGATION, DRS_NEMESIS, DRS_PACK_CARDS);
