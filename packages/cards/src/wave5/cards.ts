/**
 * The wave 5 (cycle 4) card pool: every earlier playable card plus Sinister Motives (`sm`), Nova (`nova`),
 * Ironheart (`ironheart`), Spider-Ham (`spiderham`) and SP//dr (`spdr`).
 *
 * `@mc/content` now wires cycle 4's shipped-so-far packs into its own `PLAYABLE_CARDS` directly (`card-data-
 * pipeline`, wave 5 pool-wiring pass, `data/index.ts`'s own "wave 5 wiring step" comment) — so `PLAYABLE_CARDS`
 * alone is the full pool here. **Do not also append `SM_CARDS`/`NOVA_CARDS`/`IRONHEART_CARDS`/`SPIDERHAM_CARDS`/
 * `SPDR_CARDS`**: that was this file's own historical shape (before `@mc/content` grew its own `WAVE5_CARDS`), and
 * doing so now double-counts every cycle 4 card, exactly the `wave3/cards.ts`/`wave4/cards.ts` regression their own
 * docblocks warn about (duplicate instances placed at setup, `engagedWith`/`attachedTo` reads returning the wrong
 * duplicate, duplicate ability ids at reprint-generation time, etc.) the moment `PLAYABLE_CARDS` grew cycle 4.
 * `silk` stays out (it is data-only in `@mc/content`'s pool until its own kit is scripted in a later wave).
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every playable card: Core through cycle 4's shipped-so-far packs (Sinister Motives, Nova, Ironheart,
 * Spider-Ham, SP//dr), in release order. */
export const WAVE5_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
