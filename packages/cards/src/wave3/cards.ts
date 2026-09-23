/**
 * The wave 3 (cycle 2) card pool: every earlier playable card plus the six cycle 2 packs.
 *
 * `@mc/content` now wires cycle 2 into its own `PLAYABLE_CARDS` directly (`card-data-pipeline`, wave 3 content
 * pass, docs/phase7-wave3.md), the same way wave 1 and cycle 1 already were — so `PLAYABLE_CARDS` alone is the
 * full pool here. **Do not also append `GMW_CARDS`/`STLD_CARDS`/`GAM_CARDS`/`DRAX_CARDS`/`VNM_CARDS`/`RON_CARDS`**:
 * that was this file's own historical shape (before `@mc/content` grew a `WAVE3_CARDS` of its own), and doing so
 * now double-counts every cycle 2 card, which broke several `wave3` tests (duplicate instances placed at setup,
 * `engagedWith`/`attachedTo` reads returning the wrong duplicate, etc.) the moment `PLAYABLE_CARDS` grew cycle 2.
 * `reprints.ts`, `setup.ts` and `names.ts` all import this rather than assembling their own copy.
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every playable card: Core, wave 1, cycle 1, and cycle 2, in release order. */
export const WAVE3_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
