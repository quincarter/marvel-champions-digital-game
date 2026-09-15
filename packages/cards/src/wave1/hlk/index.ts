import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { HLK_KIT } from "./kit.js";
import { HLK_NEMESIS } from "./nemesis.js";
import { HLK_OBLIGATION } from "./obligation.js";
import { HLK_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Hulk (`hlk`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is the
 * ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`.
 *
 * Two abilities are skipped — missing primitives, each recorded precisely beside where it would go:
 * - Hulk Smash (10003): an interrupt's granted overkill isn't read back for a player's attack — `kit.ts`.
 * - Beat Cop's second ability (10029, "Action: Exhaust and discard Beat Cop → deal 1 damage to a minion for each
 *   threat here") — `pack-cards.ts`.
 * Every other `hlk` ability with printed text is scripted here.
 */
export const HLK_ABILITIES: AbilityRegistry = mergeRegistries(HLK_KIT, HLK_OBLIGATION, HLK_NEMESIS, HLK_PACK_CARDS);
