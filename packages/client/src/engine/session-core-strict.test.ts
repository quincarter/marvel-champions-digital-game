import { describe, expect, test } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore, STRICT_REFUSAL, UNDO_OFF_REFUSAL } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
  watchable: true,
  room: "room00000001",
};

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    const option = legal.choice.options[0]!;
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: [option.optionId],
    };
  }
  if (legal.kind !== "turn") throw new Error("nothing legal");
  return (legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0]!).example;
}

async function started(config: SessionConfig) {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const first = await core.start(config);
  const playerId = first.snapshot.legal!.playerId;
  const result = core.dispatch(anyLegalCommand(core.legalActions(playerId)));
  expect(result.ok).toBe(true);
  return { core, playerId };
}

describe("a strict lobby room's game", () => {
  test("refuses a rewind and keeps the commands it has", async () => {
    const { core } = await started({ ...CONFIG, roomPlayMode: "strict" });
    await expect(core.rewindTo(0)).rejects.toThrow(STRICT_REFUSAL);
    expect(core.liveGame()!.game.commands.length).toBeGreaterThan(0);
  });

  test("refuses a Manual adjust command", async () => {
    const { core, playerId } = await started({ ...CONFIG, roomPlayMode: "strict" });
    const result = core.dispatch({
      type: "adjust",
      playerId,
      adjustment: { kind: "draw", playerId, count: 1 },
    } as Command);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe(STRICT_REFUSAL);
  });

  test("the live header leaves the play mode out", async () => {
    const { core } = await started({ ...CONFIG, roomPlayMode: "strict" });
    expect(core.liveGame()!.game.config).not.toHaveProperty("roomPlayMode");
  });

  test("Host control with Undo Off refuses a rewind but not a Manual adjust; Host only and Ask rewind", async () => {
    const { core, playerId } = await started({ ...CONFIG, roomPlayMode: "host", roomUndo: "off" });
    await expect(core.rewindTo(0)).rejects.toThrow(UNDO_OFF_REFUSAL);
    expect(core.liveGame()!.game.commands.length).toBeGreaterThan(0);
    const adjust = core.dispatch({
      type: "adjust",
      playerId,
      adjustment: { kind: "draw", playerId, count: 1 },
    } as Command);
    expect(adjust.ok === false && adjust.error.message === STRICT_REFUSAL).toBe(false);
    for (const roomUndo of ["host", "ask"] as const) {
      const room = await started({ ...CONFIG, roomPlayMode: "host", roomUndo });
      await expect(room.core.rewindTo(0)).resolves.toBeDefined();
    }
  });

  test("the live header leaves the undo and cheats settings out", async () => {
    const { core } = await started({ ...CONFIG, roomPlayMode: "host", roomUndo: "ask", roomCheats: true });
    const config = core.liveGame()!.game.config;
    expect(config).not.toHaveProperty("roomUndo");
    expect(config).not.toHaveProperty("roomCheats");
  });

  test("a room with Cheats on starts adjusted (header and snapshot say so); one without does not", async () => {
    const cheats = await started({ ...CONFIG, roomPlayMode: "host", roomUndo: "ask", roomCheats: true });
    expect(cheats.core.liveGame()!.game.adjusted).toBe(true);
    const next = cheats.core.dispatch(anyLegalCommand(cheats.core.legalActions(cheats.playerId)));
    expect(next.ok && next.snapshot.adjusted).toBe(true);
    const plain = await started({ ...CONFIG, roomPlayMode: "host", roomUndo: "ask" });
    expect(plain.core.liveGame()!.game.adjusted).toBeUndefined();
  });

  test("Host control and a plain watchable game rewind as before", async () => {
    for (const config of [
      { ...CONFIG, roomPlayMode: "host" as const },
      { ...CONFIG, room: undefined },
    ]) {
      const { core } = await started(config as SessionConfig);
      await expect(core.rewindTo(0)).resolves.toBeDefined();
    }
  });
});
