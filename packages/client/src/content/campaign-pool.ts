/**
 * The card pool the campaign screens read (#978): the app's pool as it is now (`currentPool`: the base game plus every
 * loaded pack), with the open run's packs swapped in (`poolWithRunPacks`: the run's own copies win, and an
 * installed version's newer cards are left out). The open run is the latest one started, loaded or written. A run whose
 * custom hero's pack was updated or removed names, draws and checks the cards its games are dealt, as its choices do
 * (`CampaignService`'s `#depsFor`).
 */
import type { AnyCard } from "@mc/content";
import { openRunPacksNow, packsClashingWithRun, poolWithRunPacks } from "../campaign/run-packs.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { currentCardsById, currentPool } from "./pool.js";

interface CampaignPoolView {
  readonly base: readonly AnyCard[];
  readonly run: readonly unknown[];
  readonly cards: readonly AnyCard[];
  readonly cardsById: ReadonlyMap<string, AnyCard>;
}

let view: CampaignPoolView | undefined;

function campaignPoolView(): CampaignPoolView {
  const base = currentPool();
  const run = openRunPacksNow();
  if (view && view.base === base && view.run === run) return view;
  // The deck editor never offers a card of an installed pack that clashes with the run's copies (#978).
  const cards = poolWithRunPacks(base, run, packsClashingWithRun(loadedPacks(), run));
  const cardsById =
    cards === base ? currentCardsById() : new Map(cards.map((card) => [card.id as string, card] as const));
  view = { base, run, cards, cardsById };
  return view;
}

/** Every card a campaign screen may name or offer. The same array until the loaded packs or the open run change. */
export const campaignPool = (): readonly AnyCard[] => campaignPoolView().cards;

/** `campaignPool()` by card id. */
export const campaignCardsById = (): ReadonlyMap<string, AnyCard> => campaignPoolView().cardsById;
