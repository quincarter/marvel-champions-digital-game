/**
 * The app pool's card list, on its own.
 *
 * `pool.ts` is the one place the app's pool is defined, but it also pulls in
 * `@mc/cards` (the whole ability registry and, through it, the engine). The
 * build needs only *which cards exist* to decide which scans to bundle
 * (`vite-card-art.ts`), so the list lives here and `pool.ts` re-exports it:
 * still one definition, importable without the rules engine.
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every card the app knows about: Core, the eight wave 1 packs and the six cycle 1 packs. */
export const POOL_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
