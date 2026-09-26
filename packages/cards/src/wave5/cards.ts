/**
 * The wave 5 (cycle 4) card pool: every earlier playable card plus Sinister Motives (`sm`).
 *
 * `sm` is data-only in `@mc/content` (docs/phase7-wave5.md, `data/index.ts`'s own "wave 5 wiring step" comment) —
 * `PLAYABLE_CARDS` doesn't include it yet, so this pack-local pool appends it, exactly the shape `wave1/cards.ts`
 * through `wave3/cards.ts` used before `@mc/content` wired their own cycles directly. **Do not also append
 * `NOVA_CARDS`/`IRONHEART_CARDS`/`SPIDERHAM_CARDS`/`SPDR_CARDS` here until those packs are actually scripted** —
 * each is data-only too, and a script-less pack in this pool would let a deck legally include cards with no
 * ability behind them (`unscriptedCards` is what marks that, not this file).
 */
import { PLAYABLE_CARDS, SM_CARDS, type AnyCard } from "@mc/content";

/** Every playable card: Core through cycle 3 (wave 4), plus Sinister Motives. */
export const WAVE5_CARDS: readonly AnyCard[] = [...PLAYABLE_CARDS, ...SM_CARDS];
