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
 * Recorded skips — missing primitives (two) and one confirmed engine bug, each documented precisely beside where
 * it would go:
 * - Vapors of Valtorr (09035, an Invocation card) — `kit.ts`.
 * - Physical Toll (09027, the obligation) — `obligation.ts`.
 * - Counterspell (09030, nemesis-set attachment) — `nemesis.ts`.
 * - Unflappable (09020) — `pack-cards.ts`.
 * - Desperate Defense (09015) — confirmed engine bug (`isAnnouncement` never lets an Interrupt fire on
 *   `on.defends`), `pack-cards.ts`.
 * Every other `drs` ability with printed text is scripted here.
 */
export const DRS_ABILITIES: AbilityRegistry = mergeRegistries(DRS_KIT, DRS_OBLIGATION, DRS_NEMESIS, DRS_PACK_CARDS);
