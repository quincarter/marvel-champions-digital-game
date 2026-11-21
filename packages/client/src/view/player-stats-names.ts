/**
 * The pool's names for the Stats screen (`player-stats-model.ts`) and the deck-building insights (`deck-insights.ts`):
 * read in the stats worker for the folds, and on the main thread by the deck builder and the Decks screen, which have
 * the pool loaded already.
 */
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import type { AnyCard, EncounterSet, Scenario, StarterDeck } from "@mc/content";
import type { SaveMeta } from "../engine/game-storage.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
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
  if (axes) return axes;
  // Once per scenario, never per set: a stats worker lives for one fold, so this runs on every read of the stats.
  const modulars = new Set(POOL_SCENARIOS.flatMap((scenario) => modularCandidatesFor(scenario).map((set) => set.id)));
  axes = {
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
  starterDeckName: (id) => POOL_STARTER_DECKS.find((deck) => (deck.id as string) === id)?.name,
  scenarioModulars: (id) =>
    POOL_SCENARIOS.find((scenario) => (scenario.id as string) === id)?.recommendedModularSetIds.map(
      (set) => set as string,
    ) ?? [],
  isVillain: (name) => villainNames().has(name),
  matchupAxes,
  setName: (id) => POOL_ENCOUNTER_SETS.find((set) => (set.id as string) === id)?.name,
};

/** Each pack's designers by pack id (`PackRuntime.authors`), for a saved pack that predates keeping them. */
export type PackDesigners = Readonly<Record<string, readonly string[]>>;

interface PackRecords {
  readonly cards: ReadonlyMap<string, AnyCard>;
  readonly decks: ReadonlyMap<string, StarterDeck>;
  readonly scenarios: ReadonlyMap<string, Scenario>;
  readonly sets: ReadonlyMap<string, EncounterSet>;
  /** Who made each piece of custom content, by its id: the designers' names joined ("A & B"). */
  readonly designers: ReadonlyMap<string, string>;
}

function recordsOf(saves: readonly Pick<SaveMeta, "config">[], known: PackDesigners = {}): PackRecords {
  const cards = new Map<string, AnyCard>();
  const decks = new Map<string, StarterDeck>();
  const scenarios = new Map<string, Scenario>();
  const sets = new Map<string, EncounterSet>();
  const designers = new Map<string, string>();
  for (const save of saves) {
    for (const pack of (save.config?.packs ?? []) as readonly PackRuntime[]) {
      const authors = (pack.authors?.length ?? 0) > 0 ? pack.authors! : (known[pack.id] ?? []);
      const designer = authors.length > 0 ? authors.join(" & ") : undefined;
      // The newest save that names a designer wins: a newer save of a pack stored before authors were kept says nothing
      // about who made it, so it never erases what an older one knew.
      const mark = (id: string): void => {
        if (designer) designers.set(id, designer);
      };
      for (const card of pack.cards) {
        cards.set(card.id as string, card);
        mark(card.id as string);
      }
      for (const deck of pack.decks) decks.set(deck.id as string, deck);
      for (const scenario of pack.scenarios ?? []) {
        scenarios.set(scenario.id as string, scenario);
        mark(scenario.id as string);
      }
      for (const set of pack.encounterSets ?? []) {
        sets.set(set.id as string, set);
        mark(set.id as string);
      }
    }
  }
  return { cards, decks, scenarios, sets, designers };
}

function layered(base: StatsNames, { cards, decks, scenarios, sets, designers }: PackRecords): StatsNames {
  if (cards.size === 0 && decks.size === 0 && scenarios.size === 0 && sets.size === 0) return base;
  return {
    ...base,
    scenarioName: (id) => scenarios.get(id)?.name ?? base.scenarioName(id),
    scenarioModulars: (id) => {
      const scenario = scenarios.get(id);
      return scenario
        ? scenario.recommendedModularSetIds.map((set) => set as string)
        : (base.scenarioModulars?.(id) ?? []);
    },
    setName: (id) => sets.get(id)?.name ?? base.setName?.(id),
    designerOf: (id) => designers.get(id) ?? base.designerOf?.(id),
    cardName: (id) => {
      const card = cards.get(id);
      return card ? cardDisplayName(card) : base.cardName(id);
    },
    cardType: (id) => cards.get(id)?.type ?? base.cardType(id),
    cardAspect: (id) => {
      const card = cards.get(id);
      return card ? ("aspect" in card ? card.aspect : undefined) : base.cardAspect(id);
    },
    starterDeck: (id) => {
      const deck = decks.get(id);
      return deck ? { identityCardId: deck.identityCardId as string, aspects: deck.aspects } : base.starterDeck(id);
    },
    starterDeckName: (id) => decks.get(id)?.name ?? base.starterDeckName?.(id),
  };
}

/**
 * The names for a set of saves: the pool's, then the cards and precons of the packs the saves were played with
 * (`SaveMeta.config.packs`), so a custom hero's deck, cards and signature marks read right with the pack uninstalled.
 * It reads the saved records only (no pack loading), so it runs in the stats worker.
 *
 * Saves may carry different versions of one pack. Per-game facts (a seat's hero and aspects from a precon id) come from
 * that save's own packs through `forSave`. The names shown for an id across games (a card's or a precon's name, a
 * card's type and aspect, the signature mark) follow one policy: the newest save's version wins (`updatedAt`, then
 * `createdAt`, then id), so the answer never depends on the order the saves arrive in.
 *
 * `designers` names who made a pack saved before its authors were kept: the installed packs', read on the main thread
 * in `player-stats-client.ts`.
 */
export function statsNamesForSaves(
  saves: readonly Pick<SaveMeta, "config" | "updatedAt" | "createdAt" | "id">[],
  base: StatsNames = POOL_STATS_NAMES,
  designers: PackDesigners = {},
): StatsNames {
  if (!saves.some((save) => (save.config?.packs?.length ?? 0) > 0)) return base;
  const oldestFirst = [...saves].sort(
    (a, b) =>
      (a.updatedAt ?? 0) - (b.updatedAt ?? 0) ||
      (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
      String(a.id ?? "").localeCompare(String(b.id ?? "")),
  );
  const aggregate = layered(base, recordsOf(oldestFirst, designers));
  const own = new WeakMap<object, StatsNames>();
  return {
    ...aggregate,
    forSave: (save) => {
      let names = own.get(save);
      if (!names) own.set(save, (names = layered(base, recordsOf([save], designers))));
      return names;
    },
  };
}
