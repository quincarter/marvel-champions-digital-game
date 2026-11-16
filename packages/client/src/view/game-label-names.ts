/**
 * The pool's names for a saved game's label (`continue-label.ts`), shared by the Title's Continue row and the
 * in-progress games list so both say the same thing about a game.
 */
import { packScenarioRecords } from "@mc/mod-sdk/game";
import type { Scenario, StarterDeck } from "@mc/content";
import {
  CARDS_BY_ID,
  currentScenarios,
  currentStarterDecks,
  POOL_SCENARIOS,
  POOL_STARTER_DECKS,
} from "../content/pool.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { CAMPAIGNS, type AnyCard } from "@mc/content";
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
  starterDeckName: (id) => currentStarterDecks().find((deck) => (deck.id as string) === id)?.name,
  campaignName: (id) => CAMPAIGNS.find((campaign) => (campaign.id as string) === id)?.name,
  // An in-progress game names its hero and precon from the packs it carries, loaded now or not.
  forPacks: (packs) => pastGameNamesForPacks(packs as readonly PackRuntime[]),
};

/** The Past games catalog's names (#706): the label's, and each game's pictures. */
export const PAST_GAME_NAMES: PastGameNames = {
  ...GAME_LABEL_NAMES,
  starterIdentity: (id) => currentStarterDecks().find((deck) => (deck.id as string) === id)?.identityCardId as string,
  scenarioCardId: (id) => {
    const scenario = currentScenarios().find((candidate) => (candidate.id as string) === id);
    return scenario ? scenarioCardIdOf(scenario) : undefined;
  },
  forPacks: (packs) => pastGameNamesForPacks(packs as readonly PackRuntime[]),
};

/**
 * A card by id from a game's own packs, else the base pool; never throws. It reads the packs' cards directly rather
 * than merging a whole pool per save (a pack shadowing a base card would throw there, and the copy is large), #758.
 */
export function cardInPacks(packs: readonly PackRuntime[] | undefined, id: string): AnyCard | undefined {
  for (const pack of packs ?? []) {
    const card = pack.cards.find((candidate) => (candidate.id as string) === id);
    if (card) return card;
  }
  return CARDS_BY_ID.get(id);
}

const PACK_NAMES = new WeakMap<object, PastGameNames>();
const PACK_SCENARIOS = new WeakMap<object, readonly Scenario[]>();

/**
 * The Past games names for a game built with `packs` (its saved `SessionConfig.packs`): the base names, then the cards
 * and scenarios of those packs, so a pack's hero and villain are found even when the pack is no longer installed (#758).
 * Cached per packs array.
 */
export function pastGameNamesForPacks(packs: readonly PackRuntime[]): PastGameNames {
  let names = PACK_NAMES.get(packs);
  if (names) return names;
  const scenarios = (): readonly Scenario[] => {
    let list = PACK_SCENARIOS.get(packs);
    if (!list) {
      list = [...POOL_SCENARIOS, ...packScenarioRecords(packs)];
      PACK_SCENARIOS.set(packs, list);
    }
    return list;
  };
  const decks = (): readonly StarterDeck[] => [...POOL_STARTER_DECKS, ...packs.flatMap((pack) => pack.decks)];
  names = {
    ...PAST_GAME_NAMES,
    starterDeckName: (id) => decks().find((deck) => (deck.id as string) === id)?.name,
    starterIdentity: (id) => decks().find((deck) => (deck.id as string) === id)?.identityCardId as string | undefined,
    scenarioName: (id) =>
      scenarios().find((candidate) => (candidate.id as string) === id)?.name ?? GAME_LABEL_NAMES.scenarioName(id),
    identityName: (id) => {
      const identity = cardInPacks(packs, id);
      return identity ? cardDisplayName(identity) : undefined;
    },
    scenarioCardId: (id) => {
      const scenario = scenarios().find((candidate) => (candidate.id as string) === id);
      return scenario ? scenarioCardIdOf(scenario) : undefined;
    },
  };
  PACK_NAMES.set(packs, names);
  return names;
}
