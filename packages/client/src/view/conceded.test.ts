/**
 * A conceded game, through every client reader of `outcome.result`.
 *
 * `GameOutcome` gained a third kind (`{ result: "conceded", reason: "playerConceded", byPlayerId }`) and all four
 * readers were ternaries, which the type checker cannot flag: each would silently have read a concession as a defeat.
 * This is the test that holds them, so a fifth reader added later has something to fail against.
 *
 * There is no RRG page here on purpose: the rules reference has no concede rule at all (see `Command`'s own note in
 * `@mc/engine`), so conceding is a digital-implementation affordance and what follows is the product decision —
 * a concession is presented as a concession, never as a loss.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { emptyRecord } from "../engine/game-record.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { boardModel } from "./board-model.js";
import { gameOverModel } from "./game-over-model.js";
import { logLine } from "./log-lines.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

describe("a conceded game", () => {
  let state: GameState;
  let viewer: PlayerId;
  let storage: MemoryGameStorage;

  beforeAll(async () => {
    storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const started = await core.start(RHINO_SOLO);
    viewer = started.snapshot.state.players[0]!.playerId;

    // Answer whatever setup parked (the mulligan), then give up.
    let snapshot = started.snapshot;
    for (let step = 0; step < 10 && snapshot.state.pendingChoice; step++) {
      const choice = snapshot.state.pendingChoice;
      const dispatched = core.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
      if (!dispatched.ok) throw new Error(dispatched.error.message);
      snapshot = dispatched.snapshot;
    }

    const conceded = core.dispatch({ type: "concede", playerId: viewer });
    if (!conceded.ok) throw new Error(conceded.error.message);
    // The core strips the card pool for transport; a host re-attaches it, and so does this test.
    state = { ...conceded.snapshot.state, cardPool: started.cardPool };
    // The save is written asynchronously; wait for the queue to drain before reading it back.
    await core.latestSave();
  }, 60_000);

  test("the engine ended the game as conceded, not as a loss", () => {
    expect(state.outcome).toEqual({ result: "conceded", reason: "playerConceded", byPlayerId: viewer });
  });

  test("the board's step label says conceded", () => {
    const model = boardModel(state, viewer, POOL_DEPS);
    expect(model.stepLabel).toBe("Conceded");
  });

  test("game over presents a concession, not a defeat", () => {
    const model = gameOverModel(state, emptyRecord(), RHINO_SOLO, POOL_DEPS);
    expect(model.kicker).toBe("Game conceded");
    expect(model.headline).toMatch(/conceded/i);
    expect(model.summary).not.toMatch(/defeat/i);
    expect(model.beatsHeading).toBe("How it went");
    // The scene only knows two palettes, so a concession takes the non-win one — the copy carries the distinction.
    expect(model.tone).toBe("loss");
  });

  test("the log says the game was conceded, in a neutral voice", () => {
    const line = logLine({ type: "gameEnded", outcome: state.outcome! }, state, viewer, POOL_DEPS);
    expect(line).not.toBeNull();
    expect(line!.text).toBe("The game was conceded.");
    expect(line!.voice).toBe("scenario");
  });

  test("the save records it as abandoned: played, but neither a win nor a loss", async () => {
    const saves = await storage.list();
    expect(saves).toHaveLength(1);
    expect(saves[0]!.status).toBe("abandoned");
    expect(saves[0]!.outcome).toEqual(state.outcome);
  });
});
