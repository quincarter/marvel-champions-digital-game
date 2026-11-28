/** The pool's Team-Up pairs, rebuilt when the loaded packs change, so a pack hero's team-up cards are known. */
import { currentCardsById, currentPoolKey } from "../../../content/pool.js";
import { pairCatalogOf } from "../../../view/seat-recommendations.js";

let cached: { readonly key: string; readonly catalog: ReturnType<typeof pairCatalogOf> } | null = null;

export function rosterPairCatalog(): ReturnType<typeof pairCatalogOf> {
  const key = currentPoolKey();
  if (cached?.key !== key) cached = { key, catalog: pairCatalogOf(currentCardsById()) };
  return cached.catalog;
}
