/**
 * The game record, folded from a real Core game's events. Real games rather
 * than crafted event lists, so attribution is checked against the sources the
 * engine actually names.
 */

import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** Starts a game with a record folded from every update, the way the host will fold it. */
async function recordedGame(config: SessionConfig) {
  const host = new LocalEngineHost();
  let record: GameRecord = emptyRecord();
  let state: GameState | null = null;
  host.subscribe((update) => {
    record = recordEvents(record, update.events, update.state);
    state = update.state;
  });
  await host.start(config);
  return {
    host,
    record: () => record,
    state: () => state!,
  };
}

describe("game record", () => {
  test("a passive table's loss is recorded to the round, with the last threat that ended it", async () => {
    const game = await recordedGame(RHINO_SOLO);
    for (let step = 0; step < 1500 && !game.state().outcome; step++) {
      const choice = game.state().pendingChoice;
      if (choice) {
        await game.host.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
        });
        continue;
      }
      const legal = await game.host.legalActions(game.state().players[0]!.playerId);
      if (legal.kind !== "turn") break;
      const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await game.host.dispatch(end.example);
    }

    const state = game.state();
    const record = game.record();
    expect(state.outcome).not.toBeNull();
    expect(record.round).toBe(state.round);
    expect(record.seats).toHaveLength(1);
    expect(record.threatPlaced).toBeGreaterThan(0);
    if (state.outcome!.reason === "mainSchemeCompleted") {
      expect(record.lastThreat).not.toBeNull();
      expect(record.lastThreat!.round).toBe(state.round);
    }
    // Rounds come back in order and never repeat.
    const rounds = record.rounds.map((entry) => entry.round);
    expect(rounds).toEqual([...new Set(rounds)].sort((a, b) => a - b));
  }, 120_000);

  test("a hero's basic attack on the villain counts toward that hero's seat", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const settle = async () => {
      for (let step = 0; step < 10; step++) {
        const choice = game.state().pendingChoice;
        if (!choice) return;
        await game.host.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
        });
      }
    };
    await settle();
    const me = game.state().players[0]!.playerId;
    const actions = async () => {
      const legal = await game.host.legalActions(me);
      return legal.kind === "turn" ? legal.legal : [];
    };
    const flip = (await actions()).find((entry) => entry.action.kind === "changeForm");
    await game.host.dispatch(flip!.example);
    await settle();
    const attack = (await actions()).find((entry) => entry.action.kind === "basicAttack");
    expect(attack).toBeDefined();
    await game.host.dispatch(attack!.example);
    await settle();

    const record = game.record();
    const seat = record.seats.find((entry) => entry.playerId === me)!;
    expect(record.damageToVillain).toBeGreaterThan(0);
    expect(seat.damage).toBe(record.damageToEnemies);
    expect(record.lastVillainDamage).not.toBeNull();
  }, 60_000);
});
