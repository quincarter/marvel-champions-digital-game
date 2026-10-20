import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { summarizeGame } from "./game-summary.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** Plays a passive table to its loss, folding the record the way the session does. */
async function passiveLoss() {
  const host = new LocalEngineHost();
  let record: GameRecord = emptyRecord();
  let state: GameState | null = null;
  host.subscribe((update) => {
    record = recordEvents(record, update.events, update.state);
    state = update.state;
  });
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
  return { state: state!, record };
}

describe("summarizeGame", () => {
  test("a game still in play has no summary", async () => {
    const host = new LocalEngineHost();
    let state: GameState | null = null;
    host.subscribe((update) => (state = update.state));
    await host.start(RHINO_SOLO);
    expect(summarizeGame(state!, emptyRecord())).toBeNull();
  });

  test("a real loss names its reason and counts the defeat, with no winners", async () => {
    const { state, record } = await passiveLoss();
    expect(state.outcome?.result).toBe("loss");
    const summary = summarizeGame(state, record)!;
    expect(summary.winners).toEqual([]);
    expect(summary.alliesPlayed).toBe(0);
    expect(summary.lossReason).toBe(
      state.outcome!.reason === "mainSchemeCompleted" ? "schemeCompleted" : "playersDefeated",
    );
    expect(summary.heroesDefeated).toBe(record.seats.filter((seat) => seat.defeatedInRound !== null).length);
  });

  test("a win lists the standing seats with their hit points, and sums allies and defeats", async () => {
    const { state, record } = await passiveLoss();
    const player = state.players[0]!;
    const hero = state.instances[player.identity.instanceId]!;
    const won: GameState = {
      ...state,
      outcome: { result: "win", reason: "villainDefeated" },
      players: [{ ...player, eliminated: false }],
      instances: { ...state.instances, [hero.instanceId]: { ...hero, damage: 0 } },
    };
    const summary = summarizeGame(won, {
      ...record,
      seats: record.seats.map((seat) => ({ ...seat, defeatedInRound: null, alliesPlayed: 2 })),
    })!;
    expect(summary.lossReason).toBeNull();
    expect(summary.heroesDefeated).toBe(0);
    expect(summary.alliesPlayed).toBe(2);
    expect(summary.winners).toHaveLength(1);
    expect(summary.winners[0]!.identityCardId).toBe(player.identity.cardId);
    expect(summary.winners[0]!.hitPoints).toBeGreaterThan(0);
    expect(summary.winners[0]!.inHeroForm).toBe(player.identity.form === "hero");
  });

  test("a concession is a loss reason of its own", async () => {
    const { state, record } = await passiveLoss();
    const conceded: GameState = {
      ...state,
      outcome: { result: "conceded", reason: "playerConceded", byPlayerId: state.players[0]!.playerId },
    };
    expect(summarizeGame(conceded, record)!.lossReason).toBe("conceded");
  });
});
