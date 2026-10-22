import { SHADOWLAND_CARDS, cardId, type AnyCard, type CardId } from "@mc/content";
import { MTS_POOL_SET_CARDS } from "./mts.js";

/**
 * Shadowland's scenarios 1 and 2 (MC65 pp. 9, 14): "Shuffle each other card from that set into the encounter deck", the
 * Black Flower set less Creeping Corruption (72A), which the campaign puts into play instead and sets aside. The real
 * set lists 72A (a player-typed upgrade whose `specificTo` is the set), so composing it would shuffle four Setup
 * upgrades into the deck; this synthetic set is the other six cards, one id per printed copy.
 */
export const SHADOWLAND_BLACK_FLOWER_REST = "shadowland.black_flower_rest";
const CREEPING_CORRUPTION = cardId("65072a");
const BLACK_FLOWER_REST: readonly CardId[] = SHADOWLAND_CARDS.flatMap((card) => {
  const inSet =
    ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes("black_flower")) ||
    ("specificTo" in card && card.specificTo?.encounterSetId === "black_flower");
  return inSet && card.id !== CREEPING_CORRUPTION ? Array.from({ length: card.quantityInSet }, () => card.id) : [];
});

/**
 * Composed set ids that are not `@mc/content` encounter sets: a campaign's own synthetic carry-forward sets, each
 * naming exactly the cards it brings (MC21's `mts.pool.*`, `./mts.ts` modeling choice 4).
 */
const SYNTHETIC_SETS: Readonly<Record<string, readonly CardId[]>> = {
  ...MTS_POOL_SET_CARDS,
  [SHADOWLAND_BLACK_FLOWER_REST]: BLACK_FLOWER_REST,
};

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
 *
 * `removedFromCampaign` is the log's removed card ids (`CampaignLog.removedFromCampaign`, either face): a removed card
 * is in no composed set (RRG 1.8 p. 29; MC32 p. 7's "Remove each Future Past card in the victory display from the
 * campaign"), so the same call that builds the deck leaves it out.
 */
export function cardsOfComposedSets(
  pool: readonly AnyCard[],
  setIds: readonly string[],
  removedFromCampaign: readonly CardId[] = [],
): CardId[] {
  const out: CardId[] = [];
  const removed = new Set<string>(removedFromCampaign);
  for (const setId of setIds) {
    const synthetic = SYNTHETIC_SETS[setId];
    if (synthetic) {
      out.push(...synthetic.filter((id) => !removed.has(id)));
      continue;
    }
    for (const card of pool) {
      const inSet =
        ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)) ||
        ("specificTo" in card && card.specificTo?.encounterSetId === setId);
      if (!inSet) continue;
      if (removed.has(card.id)) continue;
      for (let copy = 0; copy < card.quantityInSet; copy++) out.push(card.id);
    }
  }
  return out;
}
