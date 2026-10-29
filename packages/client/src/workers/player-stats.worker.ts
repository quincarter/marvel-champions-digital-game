/**
 * The stats worker (`view/player-stats-client.ts` owns it): folds the saved games into the Stats screen's rows, or into
 * the deck-building insights, with the pool's names, off the main thread. All the logic is
 * `view/player-stats-model.ts`'s and `view/deck-insights.ts`'s, which the tests call directly.
 */
import { deckInsightsOf } from "../view/deck-insights.js";
import { playerStatsOf } from "../view/player-stats-model.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import type { StatsRequest, StatsResponse } from "../view/player-stats-client.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: StatsResponse): void;
  onmessage: ((event: MessageEvent<StatsRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;

worker.onmessage = (event: MessageEvent<StatsRequest>) => {
  const { saves, kind } = event.data;
  worker.postMessage(
    kind === "insights"
      ? { insights: deckInsightsOf(saves, POOL_STATS_NAMES) }
      : { stats: playerStatsOf(saves, POOL_STATS_NAMES) },
  );
};
