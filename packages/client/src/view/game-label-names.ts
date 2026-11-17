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
  POOL_ENCOUNTER_SETS,
  POOL_SCENARIOS,
  POOL_STARTER_DECKS,
} from "../content/pool.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { CAMPAIGNS, type AnyCard } from "@mc/content";
import type { GamesListNames } from "./games-list-model.js";
import type { PastGameNames } from "./past-games-model.js";
import type { TrackerExportNames } from "./tracker-export.js";
import { scenarioCardIdOf } from "./random-villain.js";
import { cardDisplayName } from "./hero-names.js";
import { hasSetAsideModularChoice, setAsideCandidateIdsFor } from "./hood-modular-sets.js";

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
  cardName: (id) => {
    const card = CARDS_BY_ID.get(id);
    return card ? cardDisplayName(card) : undefined;
  },
  starterIdentity: (id) => currentStarterDecks().find((deck) => (deck.id as string) === id)?.identityCardId as string,
  starterAspects: (id) =>
    currentStarterDecks().find((deck) => (deck.id as string) === id)?.aspects as string[] | undefined,
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
    cardName: (id) => {
      const card = cardInPacks(packs, id);
      return card ? cardDisplayName(card) : undefined;
    },
    starterDeckName: (id) => decks().find((deck) => (deck.id as string) === id)?.name,
    starterIdentity: (id) => decks().find((deck) => (deck.id as string) === id)?.identityCardId as string | undefined,
    starterAspects: (id) => decks().find((deck) => (deck.id as string) === id)?.aspects as string[] | undefined,
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

/** The names the MC Tracker export adds to a game's (`view/tracker-export.ts`), from the game's own packs first (#757). */
export const TRACKER_EXPORT_NAMES: TrackerExportNames = {
  ...PAST_GAME_NAMES,
  heroFace: (id, packs) => {
    const card = cardInPacks(packs as readonly PackRuntime[] | undefined, id);
    return card?.type === "hero_identity" ? { hero: card.hero.faceName, alterEgo: card.alterEgo.faceName } : undefined;
  },
  setName: (id, packs) =>
    ((packs as readonly PackRuntime[] | undefined)?.flatMap((pack) => pack.encounterSets ?? []) ?? [])
      .concat(POOL_ENCOUNTER_SETS)
      .find((set) => (set.id as string) === id)?.name,
  recommendedSets: (scenarioId, packs) => {
    const own = packScenarioRecords((packs ?? []) as readonly PackRuntime[]);
    const scenario = [...POOL_SCENARIOS, ...own].find((candidate) => (candidate.id as string) === scenarioId);
    return scenario?.recommendedModularSetIds as readonly string[] | undefined;
  },
  // The Hood's builder sets aside the first N candidates (`wave4/setup.ts`); a per-player count (Mojo) is random.
  defaultSetAsideSets: (scenarioId) => {
    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === scenarioId);
    return scenario && hasSetAsideModularChoice(scenario)
      ? setAsideCandidateIdsFor(scenario).slice(0, scenario.setAsideModularSetCount as number)
      : undefined;
  },
};
