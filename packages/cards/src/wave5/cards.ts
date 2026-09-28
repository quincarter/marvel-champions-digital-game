/**
 * The wave 5 (cycle 4) card pool: every earlier playable card plus Sinister Motives (`sm`), Nova (`nova`),
 * Ironheart (`ironheart`) and Spider-Ham (`spiderham`).
 *
 * `sm`/`nova`/`ironheart`/`spiderham`/`spdr` are data-only in `@mc/content` (docs/phase7-wave5.md, `data/index.ts`'s
 * own "wave 5 wiring step" comment) — `PLAYABLE_CARDS` doesn't include them yet, so this pack-local pool appends
 * them, exactly the shape `wave1/cards.ts` through `wave3/cards.ts` used before `@mc/content` wired their own
 * cycles directly. Adding a pack here is safe as soon as its own `index.ts` scaffold exists, even before every
 * card is scripted — `unscriptedCards` refuses any deck that still names an unscripted card of that pack, but is
 * an opt-in legality check, not something this file or `createGame` itself enforces.
 */
import {
  IRONHEART_CARDS,
  NOVA_CARDS,
  PLAYABLE_CARDS,
  SM_CARDS,
  SPDR_CARDS,
  SPIDERHAM_CARDS,
  type AnyCard,
} from "@mc/content";

/** Every playable card: Core through cycle 3 (wave 4), plus Sinister Motives, Nova, Ironheart, Spider-Ham and
 * SP//dr. */
export const WAVE5_CARDS: readonly AnyCard[] = [
  ...PLAYABLE_CARDS,
  ...SM_CARDS,
  ...NOVA_CARDS,
  ...IRONHEART_CARDS,
  ...SPIDERHAM_CARDS,
  ...SPDR_CARDS,
];
