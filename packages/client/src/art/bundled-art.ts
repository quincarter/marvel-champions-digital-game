/**
 * Which scans a build has to carry: every picture any card in the pool can ask
 * for, plus the three card backs.
 *
 * Pure, so it is tested here and merely *used* by `vite-card-art.ts`. It is the
 * pool's share of `assets/card-art/`, not the whole folder, for two reasons:
 * the folder holds every card MarvelCDB publishes (thousands the app cannot
 * draw), and Tauri embeds the whole of `dist/` into the desktop binary, so
 * every needless scan is paid for at compile time and again at launch. As packs
 * join the pool their scans join the bundle, with no list to maintain.
 */
import type { AnyCard } from "@mc/content";
import { POOL_CARDS } from "../content/pool-cards.js";
import { CARD_BACKS, allArtFor, artPathOf } from "./art-source.js";

/** Paths relative to `assets/card-art/` (and to `/card-art/` once served), sorted and unique. */
export function bundledArtPaths(cards: readonly AnyCard[]): readonly string[] {
  const paths = new Set<string>(Object.values(CARD_BACKS).map(artPathOf));
  for (const card of cards) for (const art of allArtFor(card)) paths.add(artPathOf(art));
  return [...paths].sort();
}

/**
 * The app pool's scans: exactly what a build copies. `vite-card-art.ts` calls
 * this and nothing else, so the plugin never names the pool itself — widening
 * the pool in `content/pool-cards.ts` widens the bundle with no second edit.
 */
export function poolArtPaths(): { readonly cardCount: number; readonly paths: readonly string[] } {
  return { cardCount: POOL_CARDS.length, paths: bundledArtPaths(POOL_CARDS) };
}
