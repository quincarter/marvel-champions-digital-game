/**
 * The main-thread side of the stats worker: one request (the saved games' rows), one answer (the Stats screen's rows),
 * then the worker is ended. Where there is no `Worker` (Vitest, a browser that refuses one), or the worker fails, the
 * same fold runs here.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import type { PlayerStats } from "./player-stats-model.js";

export interface StatsRequest {
  readonly saves: readonly SaveMeta[];
}

export interface StatsResponse {
  readonly stats: PlayerStats;
}

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

/** The stats for these saves, worked out in a worker that ends as soon as it answers. */
export function loadPlayerStats(
  saves: readonly SaveMeta[],
  factory: StatsWorkerFactory = spawnStatsWorker,
): Promise<PlayerStats> {
  const worker = factory();
  if (!worker) return statsHere(saves);
  return new Promise<PlayerStats>((resolve) => {
    const finish = (stats: PlayerStats | null): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      if (stats) resolve(stats);
      else void statsHere(saves).then(resolve);
    };
    worker.onmessage = (event) => finish(event.data.stats);
    worker.onerror = () => finish(null);
    try {
      worker.postMessage({ saves });
    } catch {
      finish(null);
    }
  });
}
