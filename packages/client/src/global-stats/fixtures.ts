/** Shared stand-ins for the global-stats tests. */
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import type { GameSummary } from "../engine/game-summary.js";
import type { StatsNames } from "../view/player-stats-model.js";
import type { ConsentStorage } from "./global-consent.js";

export const NAMES: StatsNames = {
  cardName: (id) => ({ spidey: "Spider-Man", cap: "Captain America" })[id],
  cardType: () => "event",
  cardAspect: () => undefined,
  scenarioName: (id) => ({ rhino: "Rhino" })[id],
  starterDeck: () => undefined,
  scenarioModulars: () => ["bomb_scare"],
  setName: (id) => ({ bomb_scare: "Bomb Scare", ambush: "Ambush" })[id],
};

let n = 0;
export const meta = (overrides: Partial<SaveMeta> = {}, summary: Partial<GameSummary> | null = {}): SaveMeta => ({
  id: `save-${n++}`,
  schema: SAVE_SCHEMA,
  config: {
    scenarioId: "rhino",
    difficulty: "expert",
    players: [{ starterDeckId: "x" }],
    seed: 987654,
    modularSetIds: ["bomb_scare"],
  },
  createdAt: 1000,
  updatedAt: 2000 + n,
  status: "won",
  round: 6,
  commandCount: 99,
  outcome: { result: "win", reason: "villainDefeated" },
  campaignId: null,
  campaignNodeId: null,
  summary:
    summary === null
      ? null
      : {
          lossReason: null,
          heroesDefeated: 0,
          winners: [],
          alliesPlayed: 0,
          villains: ["Rhino"],
          version: 5,
          seats: [
            {
              identityCardId: "spidey",
              aspects: ["justice"],
              deck: ["webs", "aunt", "webs"],
              plays: {},
              activations: {},
              entered: {},
              damage: 1,
              thwart: 1,
              defeated: false,
            },
          ],
          ...summary,
        },
  ...overrides,
});

export const memoryStorage = (initial: Record<string, string> = {}): ConsentStorage & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};

export const jsonResponse = (status: number, body: unknown = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
