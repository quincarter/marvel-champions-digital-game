import type { AnyCard, CardId } from "@mc/content";
import { MTS_POOL_SET_CARDS } from "./mts.js";

/**
 * Composed set ids that are not `@mc/content` encounter sets: a campaign's own synthetic carry-forward sets, each
 * naming exactly the cards it brings (MC21's `mts.pool.*`, `./mts.ts` modeling choice 4).
 */
const SYNTHETIC_SETS: Readonly<Record<string, readonly CardId[]>> = { ...MTS_POOL_SET_CARDS };

/**
 * The cards of the encounter sets a campaign composed (`CampaignGameStart.encounterSets`, `startGameFromLog`), one id
 * per printed copy, for the caller to put in `GameSetupConfig.encounterDeck` / `.setAside` before `createGame`. The
 * campaign runner names sets; this is the one place a set id becomes cards, so the tests and the client agree.
 *
 * A card belongs to a set when its `encounterSetIds` names it, or when it is a campaign- or scenario-specific card
 * whose `specificTo.encounterSetId` does (MC21's Norn Stone, 21187a, and Cosmo, 21180b: no `encounterSetIds`). Both
 * faces of a double-sided card are separate records and each gets an instance, as GMW's Campaign Challenge set needs
 * (its expert setup selects the B face by printed id). A synthetic set (`SYNTHETIC_SETS`) is exactly its listed
 * cards, one copy each.
 */
export function cardsOfComposedSets(pool: readonly AnyCard[], setIds: readonly string[]): CardId[] {
  const out: CardId[] = [];
  for (const setId of setIds) {
    const synthetic = SYNTHETIC_SETS[setId];
    if (synthetic) {
      out.push(...synthetic);
      continue;
    }
    for (const card of pool) {
      const inSet =
        ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)) ||
        ("specificTo" in card && card.specificTo?.encounterSetId === setId);
      if (!inSet) continue;
      for (let copy = 0; copy < card.quantityInSet; copy++) out.push(card.id);
    }
  }
  return out;
}
