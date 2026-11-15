/**
 * The pool's names for a saved game's label (`continue-label.ts`), shared by the Title's Continue row and the
 * in-progress games list so both say the same thing about a game.
 */
import { CARDS_BY_ID, currentScenarios, POOL_STARTER_DECKS } from "../content/pool.js";
import { CAMPAIGNS } from "@mc/content";
import type { GamesListNames } from "./games-list-model.js";
import type { PastGameNames } from "./past-games-model.js";
import { scenarioCardIdOf } from "./random-villain.js";
import { cardDisplayName } from "./hero-names.js";

export const GAME_LABEL_NAMES: GamesListNames = {
  scenarioName: (id) => currentScenarios().find((candidate) => (candidate.id as string) === id)?.name,
  identityName: (id) => {
    const identity = CARDS_BY_ID.get(id);
    return identity ? cardDisplayName(identity) : undefined;
  },
  starterDeckName: (id) => POOL_STARTER_DECKS.find((deck) => (deck.id as string) === id)?.name,
  campaignName: (id) => CAMPAIGNS.find((campaign) => (campaign.id as string) === id)?.name,
};

/** The Past games catalog's names (#706): the label's, and each game's pictures. */
export const PAST_GAME_NAMES: PastGameNames = {
  ...GAME_LABEL_NAMES,
  starterIdentity: (id) => POOL_STARTER_DECKS.find((deck) => (deck.id as string) === id)?.identityCardId as string,
  scenarioCardId: (id) => {
    const scenario = currentScenarios().find((candidate) => (candidate.id as string) === id);
    return scenario ? scenarioCardIdOf(scenario) : undefined;
  },
};
