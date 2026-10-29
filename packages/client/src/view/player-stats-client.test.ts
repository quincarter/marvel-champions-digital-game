import { describe, expect, test } from "vitest";
import { loadPlayerStats, type StatsWorkerLike } from "./player-stats-client.js";
import type { PlayerStats } from "./player-stats-model.js";

const ANSWER: PlayerStats = {
  header: { record: "1–0", rate: "100% win rate", played: "1 game played", streak: "", fraction: 1 },
  sections: [],
  overview: { tiles: [], note: null },
  heroCards: [],
};

function fakeWorker(reply: "answer" | "error"): StatsWorkerLike & { terminated: boolean } {
  const worker = {
    terminated: false,
    onmessage: null as StatsWorkerLike["onmessage"],
    onerror: null as StatsWorkerLike["onerror"],
    postMessage() {
      queueMicrotask(() =>
        reply === "answer" ? worker.onmessage?.({ data: { stats: ANSWER } }) : worker.onerror?.({}),
      );
    },
    terminate() {
      worker.terminated = true;
    },
  };
  return worker;
}

describe("loadPlayerStats", () => {
  test("the worker's answer is used, and the worker is ended once it answers", async () => {
    const worker = fakeWorker("answer");
    await expect(loadPlayerStats([], () => worker)).resolves.toBe(ANSWER);
    expect(worker.terminated).toBe(true);
  });

  test("a failed worker is ended and the stats are worked out here instead", async () => {
    const worker = fakeWorker("error");
    const stats = await loadPlayerStats([], () => worker);
    expect(worker.terminated).toBe(true);
    expect(stats.header.rate).toBe("No games yet");
  });

  test("with no worker at all, the stats are worked out here", async () => {
    const stats = await loadPlayerStats([], () => null);
    expect(stats.sections.map((s) => s.id)).toEqual(["overview"]);
  });
});

describe("loadDeckInsights", () => {
  test("with no worker, the insights are worked out here", async () => {
    const { loadDeckInsights } = await import("./player-stats-client.js");
    await expect(loadDeckInsights([], () => null)).resolves.toEqual({ heroes: {}, decks: {} });
  });
});
