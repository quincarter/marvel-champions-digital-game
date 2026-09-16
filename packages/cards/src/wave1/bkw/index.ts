import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BKW_KIT } from "./kit.js";
import { BKW_NEMESIS } from "./nemesis.js";
import { BKW_OBLIGATION } from "./obligation.js";
import { BKW_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Black Widow (`bkw`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This
 * is the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`. Every ability ref for
 * this pack now resolves — 0 skips.
 *
 * Taskmaster's Boost (08026.boost, `nemesis.ts`) was a skip until the wave B primitives batch confirmed it needs
 * no new engine primitive: `modifyStat(stat, n, theVillain, "endOfAttack")` already says "for this activation, the
 * villain gets +N" regardless of which enemy is actually activating.
 */
export const BKW_ABILITIES: AbilityRegistry = mergeRegistries(BKW_KIT, BKW_OBLIGATION, BKW_NEMESIS, BKW_PACK_CARDS);

export { BKW_NEMESIS_SKIPPED } from "./nemesis.js";
export { BKW_OBLIGATION_SKIPPED } from "./obligation.js";
