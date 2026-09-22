/**
 * The wave 3 (cycle 2) card pool: every earlier playable card plus the six cycle 2 packs. `WAVE1_CARDS` and
 * `WAVE2_CARDS` are *siblings*, not nested (both start from Core independently — `../wave2/reprints.ts`'s own
 * docblock and `@mc/content`'s `PLAYABLE_CARDS` comment say so directly), so "every earlier card" is
 * `PLAYABLE_CARDS` (`@mc/content`'s own Core+wave1+cycle1 union), not `WAVE2_CARDS` alone — an earlier version of
 * this file used `WAVE2_CARDS` alone and silently lost every wave 1 pack, which broke reprint matching for cards
 * like Desperate Defense (`gmw` 16013, reprinting `drs` 09015; caught by `reprints.test.ts`).
 *
 * `@mc/content` has no `WAVE3_CARDS` aggregate of its own — cycle 2 (docs/phase7-wave3.md) landed as six
 * independent data-only packs (`GMW_CARDS`, `STLD_CARDS`, `GAM_CARDS`, `DRAX_CARDS`, `VNM_CARDS`, `RON_CARDS`),
 * not a pre-concatenated export — so this module builds the pool here. `reprints.ts`, `setup.ts` and `names.ts`
 * all import this rather than assembling their own copy.
 */
import {
  DRAX_CARDS,
  GAM_CARDS,
  GMW_CARDS,
  PLAYABLE_CARDS,
  RON_CARDS,
  STLD_CARDS,
  VNM_CARDS,
  type AnyCard,
} from "@mc/content";

/** Every earlier playable card (Core, wave 1, cycle 1) plus every cycle 2 (`gmw`, `stld`, `gam`, `drax`, `vnm`,
 * `ron`) card, in release order. */
export const WAVE3_CARDS: readonly AnyCard[] = [
  ...PLAYABLE_CARDS,
  ...GMW_CARDS,
  ...STLD_CARDS,
  ...GAM_CARDS,
  ...DRAX_CARDS,
  ...VNM_CARDS,
  ...RON_CARDS,
];
