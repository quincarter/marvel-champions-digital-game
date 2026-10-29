import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { MemoryGameStorage, SAVE_SCHEMA, type SaveMeta } from "./game-storage.js";
import { needsBackfill } from "./summary-backfill.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

const WRITER = { appVersion: "1.0.0", contentVersion: "x", build: "abc" };

/** Plays a passive table to its loss through the host, so the game is stored as a live one would be. */
async function finishedGame(storage: MemoryGameStorage): Promise<SaveMeta> {
  const host = new LocalEngineHost(storage);
  let state: GameState | null = null;
  host.subscribe((update) => (state = update.state));
  await host.start(RHINO_SOLO);
  for (let step = 0; step < 1500 && !state!.outcome; step++) {
    const choice = state!.pendingChoice;
    if (choice) {
      await host.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
      continue;
    }
    const legal = await host.legalActions(state!.players[0]!.playerId);
    if (legal.kind !== "turn") break;
    const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await host.dispatch(end.example);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [meta] = await storage.list();
  return meta!;
}

describe("backfillSummaries (#529)", () => {
  test("a game finished before card numbers were kept gets the same summary a live game records", async () => {
    const storage = new MemoryGameStorage();
    const live = await finishedGame(storage);
    expect(live.status).toBe("lost");
    expect(live.summary?.seats).toBeDefined();
    // As an older build left it: the summary without the per-seat card numbers.
    const { seats: _seats, villains: _villains, sideSchemes: _side, ...older } = live.summary!;
    await storage.setSummary(live.id, older, live.updatedAt);

    const written = await new LocalEngineHost(storage).backfillSummaries();
    expect(written).toBe(1);
    const [filled] = await storage.list();
    expect(filled!.summary).toEqual(live.summary);
    // Stamped one millisecond later, so sync carries it; status and device stamp are untouched.
    expect(filled!.updatedAt).toBe(live.updatedAt + 1);
    expect(filled!.status).toBe("lost");
    expect(filled!.lastPlayedOn).toEqual(live.lastPlayedOn);

    // Nothing is left to fill in.
    expect(await new LocalEngineHost(storage).backfillSummaries()).toBe(0);
  }, 120_000);
});

describe("needsBackfill", () => {
  const meta = (overrides: Partial<SaveMeta> = {}): SaveMeta => ({
    id: "g",
    schema: SAVE_SCHEMA,
    config: RHINO_SOLO,
    createdAt: 1,
    updatedAt: 2,
    status: "won",
    round: 3,
    commandCount: 10,
    outcome: { result: "win", reason: "villainDefeated" },
    campaignId: null,
    campaignNodeId: null,
    ...overrides,
  });

  test("a finished game with no card numbers needs it, whichever older build wrote it", () => {
    expect(needsBackfill(meta(), WRITER)).toBe(true);
    expect(needsBackfill(meta({ lastPlayedOn: { appVersion: "0.9.0", build: "old" } }), WRITER)).toBe(true);
  });

  test("not a game in play, a guided game, one with card numbers, another save format or a newer app's", () => {
    expect(needsBackfill(meta({ status: "active" }), WRITER)).toBe(false);
    expect(needsBackfill(meta({ guided: { kind: "tutorial" } as never }), WRITER)).toBe(false);
    expect(
      needsBackfill(
        meta({ summary: { lossReason: null, heroesDefeated: 0, winners: [], alliesPlayed: 0, seats: [] } }),
        WRITER,
      ),
    ).toBe(false);
    expect(needsBackfill(meta({ schema: SAVE_SCHEMA - 1 }), WRITER)).toBe(false);
    expect(needsBackfill(meta({ lastPlayedOn: { appVersion: "9.0.0" } }), WRITER)).toBe(false);
  });
});
