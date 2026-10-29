/**
 * The main-thread side of the stats worker: one request (the saved games' rows and what to fold them into), one answer,
 * then the worker is ended. Two folds: the Stats screen's rows (`loadPlayerStats`) and the deck-building insights the
 * deck builder and the Decks screen read (`loadDeckInsights`, `view/deck-insights.ts`). Where there is no `Worker`
 * (Vitest, a browser that refuses one), or the worker fails, the same fold runs here.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import type { DeckInsights } from "./deck-insights.js";
import type { PlayerStats } from "./player-stats-model.js";

export interface StatsRequest {
  readonly saves: readonly SaveMeta[];
  /** Absent: the Stats screen's rows. */
  readonly kind?: "stats" | "insights";
}

export type StatsResponse = { readonly stats: PlayerStats } | { readonly insights: DeckInsights };

/** The part of `Worker` used, so a test can stand in for it. */
export interface StatsWorkerLike {
  postMessage(message: StatsRequest): void;
  onmessage: ((event: { readonly data: StatsResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export type StatsWorkerFactory = () => StatsWorkerLike | null;

export const spawnStatsWorker: StatsWorkerFactory = () => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/player-stats.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-player-stats",
    }) as unknown as StatsWorkerLike;
  } catch {
    return null;
  }
};

async function statsHere(saves: readonly SaveMeta[]): Promise<PlayerStats> {
  const [{ playerStatsOf }, { POOL_STATS_NAMES }] = await Promise.all([
    import("./player-stats-model.js"),
    import("./player-stats-names.js"),
  ]);
  return playerStatsOf(saves, POOL_STATS_NAMES);
}

async function insightsHere(saves: readonly SaveMeta[]): Promise<DeckInsights> {
  const [{ deckInsightsOf }, { POOL_STATS_NAMES }] = await Promise.all([
    import("./deck-insights.js"),
    import("./player-stats-names.js"),
  ]);
  return deckInsightsOf(saves, POOL_STATS_NAMES);
}

/** One request to a worker that ends as soon as it answers; `here` when there is no worker or it fails. */
function ask<T>(
  request: StatsRequest,
  pick: (response: StatsResponse) => T | undefined,
  here: () => Promise<T>,
  factory: StatsWorkerFactory,
): Promise<T> {
  const worker = factory();
  if (!worker) return here();
  return new Promise<T>((resolve) => {
    const finish = (answer: T | undefined): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      if (answer !== undefined) resolve(answer);
      else void here().then(resolve);
    };
    worker.onmessage = (event) => finish(pick(event.data));
    worker.onerror = () => finish(undefined);
    try {
      worker.postMessage(request);
    } catch {
      finish(undefined);
    }
  });
}

/** The Stats screen's rows for these saves. */
export function loadPlayerStats(
  saves: readonly SaveMeta[],
  factory: StatsWorkerFactory = spawnStatsWorker,
): Promise<PlayerStats> {
  return ask(
    { saves },
    (response) => ("stats" in response ? response.stats : undefined),
    () => statsHere(saves),
    factory,
  );
}

/** The deck-building insights for these saves: every hero's and every deck's games. */
export function loadDeckInsights(
  saves: readonly SaveMeta[],
  factory: StatsWorkerFactory = spawnStatsWorker,
): Promise<DeckInsights> {
  return ask(
    { saves, kind: "insights" },
    (response) => ("insights" in response ? response.insights : undefined),
    () => insightsHere(saves),
    factory,
  );
}
