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
 * One ability is still skipped — a missing primitive, recorded precisely beside where it would go:
 * - Beat Cop's second ability (10029, "Action: Exhaust and discard Beat Cop → deal 1 damage to a minion for each
 *   threat here") — `pack-cards.ts`.
 * Hulk Smash (10003) was a skip for the same reason until the 2026-09-15 engine fix landed (see `kit.ts`); it's
 * scripted there now. Every other `hlk` ability with printed text is scripted here.
 */
export const HLK_ABILITIES: AbilityRegistry = mergeRegistries(HLK_KIT, HLK_OBLIGATION, HLK_NEMESIS, HLK_PACK_CARDS);
