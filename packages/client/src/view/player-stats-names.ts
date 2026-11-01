/**
 * The pool's names for the Stats screen (`player-stats-model.ts`) and the deck-building insights (`deck-insights.ts`):
 * read in the stats worker for the folds, and on the main thread by the deck builder and the Decks screen, which have
 * the pool loaded already.
 */
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { cardDisplayName } from "./hero-names.js";
import type { MatchupAxes } from "./matchup-grid.js";
import { modularCandidatesFor } from "./modular-candidates.js";
import type { StatsNames } from "./player-stats-model.js";

let villains: ReadonlySet<string> | undefined;
/** Villain card names (what a summary's `villains` holds), plus scenario names, which stand in on an older save. */
function villainNames(): ReadonlySet<string> {
  villains ??= new Set([
    ...[...CARDS_BY_ID.values()].filter((card) => card.type === "villain").map((card) => card.name),
    ...POOL_SCENARIOS.map((scenario) => scenario.name),
  ]);
  return villains;
}

let axes: MatchupAxes | undefined;
/** Everything the Matchups grids can show, in release order: the scenarios, one column per hero, every modular set. */
function matchupAxes(): MatchupAxes {
  // Once per scenario, never per set: a stats worker lives for one fold, so this runs on every read of the stats.
  const modulars = new Set(POOL_SCENARIOS.flatMap((scenario) => modularCandidatesFor(scenario).map((set) => set.id)));
  axes ??= {
    scenarios: POOL_SCENARIOS.map((scenario) => ({ id: scenario.id as string, name: scenario.name })),
    heroes: [...new Set(POOL_STARTER_DECKS.map((deck) => deck.identityCardId as string))].map((id) => {
      const card = CARDS_BY_ID.get(id);
      return { id, name: card ? cardDisplayName(card) : id };
    }),
    modulars: POOL_ENCOUNTER_SETS.filter((set) => modulars.has(set.id as string)).map((set) => ({
      id: set.id as string,
      name: set.name,
    })),
  };
  return axes;
}

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
  scenarioModulars: (id) =>
    POOL_SCENARIOS.find((scenario) => (scenario.id as string) === id)?.recommendedModularSetIds.map(
      (set) => set as string,
    ) ?? [],
  isVillain: (name) => villainNames().has(name),
  matchupAxes,
  setName: (id) => POOL_ENCOUNTER_SETS.find((set) => (set.id as string) === id)?.name,
};
