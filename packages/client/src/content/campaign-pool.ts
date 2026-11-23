/**
 * The card pool the campaign screens read (#978): the app's pool as it is now (`currentPool`: the base game plus every
 * loaded pack), plus the cards of the packs the runs opened this session carry (`campaign/run-packs.ts`) that the pool
 * does not already hold. A run whose custom hero's pack was updated or removed still names, draws and checks its cards.
 * An installed card wins over a run's older copy of it, as the run's choices read it (`CampaignService`'s `#depsFor`).
 */
import type { AnyCard } from "@mc/content";
import { rememberedRunPacks } from "../campaign/run-packs.js";
import { currentCardsById, currentPool } from "./pool.js";

interface CampaignPoolView {
  readonly base: readonly AnyCard[];
  readonly remembered: readonly unknown[];
  readonly cards: readonly AnyCard[];
  readonly cardsById: ReadonlyMap<string, AnyCard>;
}

let view: CampaignPoolView | undefined;

function campaignPoolView(): CampaignPoolView {
  const base = currentPool();
  const remembered = rememberedRunPacks();
  if (view && view.base === base && view.remembered === remembered) return view;
  const byId = currentCardsById();
  const added = remembered.flatMap((pack) => pack.cards).filter((card) => !byId.has(card.id as string));
  if (added.length === 0) {
    view = { base, remembered, cards: base, cardsById: byId };
  } else {
    const seen = new Set<string>();
    const unique = added.filter((card) => !seen.has(card.id as string) && seen.add(card.id as string));
    const cards = [...base, ...unique];
    view = { base, remembered, cards, cardsById: new Map(cards.map((card) => [card.id as string, card] as const)) };
  }
  return view;
}

/** Every card a campaign screen may name or offer. The same array until the loaded or remembered packs change. */
export const campaignPool = (): readonly AnyCard[] => campaignPoolView().cards;

/** `campaignPool()` by card id. */
export const campaignCardsById = (): ReadonlyMap<string, AnyCard> => campaignPoolView().cardsById;
