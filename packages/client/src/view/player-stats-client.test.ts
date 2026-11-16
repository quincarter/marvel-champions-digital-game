import { describe, expect, test } from "vitest";
import { loadPlayerStats, type StatsWorkerLike } from "./player-stats-client.js";
import type { PlayerStats } from "./player-stats-model.js";

const ANSWER: PlayerStats = {
  header: { record: "1–0", rate: "100% win rate", played: "1 game played", streak: "", fraction: 1 },
  sections: [],
  overview: { tiles: [], note: null },
  heroCards: [],
  allCards: null,
  aspects: [],
  decks: [],
  matchups: null,
  filter: {},
  filterOptions: { heroes: [], villains: [], difficulties: [] },
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
    await expect(loadDeckInsights([], () => null)).resolves.toEqual({ heroes: {}, decks: {}, villains: {} });
  });
});

describe("main-thread fallback names", () => {
  const PACK = {
    id: "sample",
    cards: [
      {
        id: "x.sample.hero",
        type: "hero_identity",
        name: "Sample",
        hero: { faceName: "S" },
        alterEgo: { faceName: "s" },
      },
    ],
    decks: [{ id: "x.sample.deck", name: "Sample Deck", identityCardId: "x.sample.hero", aspects: ["justice"] }],
  };
  const customGame = {
    id: "g",
    schema: 1,
    config: {
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "x.sample.deck" }],
      seed: 1,
      packs: [PACK],
    },
    createdAt: 1,
    updatedAt: 2,
    status: "won",
    round: 3,
    commandCount: 5,
    outcome: { result: "win", reason: "villainDefeated" },
    campaignId: null,
    campaignNodeId: null,
  } as never;

  test("a null worker factory and a failing worker both resolve a custom precon seat", async () => {
    const { loadDeckInsights } = await import("./player-stats-client.js");
    const viaNull = await loadPlayerStats([customGame], () => null);
    const viaError = await loadPlayerStats([customGame], () => fakeWorker("error"));
    expect(viaError).toEqual(viaNull);
    expect(viaNull.decks.map((d) => d.name)).toContain("Sample Deck");
    const insightsNull = await loadDeckInsights([customGame], () => null);
    const insightsError = await loadDeckInsights([customGame], () => fakeWorker("error"));
    expect(insightsError).toEqual(insightsNull);
    expect(Object.keys(insightsNull.heroes)).toContain("x.sample.hero");
  });
});
