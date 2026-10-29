/**
 * The pool's names for the Stats screen (`player-stats-model.ts`). Imported only by the stats worker and its fallback,
 * so the pool's evaluation stays off the main thread wherever a worker runs.
 */
import { CARDS_BY_ID, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { cardDisplayName } from "./hero-names.js";
import type { StatsNames } from "./player-stats-model.js";

export const POOL_STATS_NAMES: StatsNames = {
  cardName: (id) => {
    const card = CARDS_BY_ID.get(id);
    return card ? cardDisplayName(card) : undefined;
  },
  cardType: (id) => CARDS_BY_ID.get(id)?.type,
  cardAspect: (id) => {
    const card = CARDS_BY_ID.get(id);
    return card && "aspect" in card ? card.aspect : undefined;
  },
  scenarioName: (id) => POOL_SCENARIOS.find((scenario) => (scenario.id as string) === id)?.name,
  starterDeck: (id) => {
    const deck = POOL_STARTER_DECKS.find((candidate) => (candidate.id as string) === id);
    return deck ? { identityCardId: deck.identityCardId as string, aspects: deck.aspects } : undefined;
  },
};
