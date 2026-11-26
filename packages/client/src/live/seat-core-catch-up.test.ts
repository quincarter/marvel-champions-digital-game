import { describe, expect, test } from "vitest";
import type { Command, GameState, PlayerId } from "@mc/engine";
import { actingPlayer } from "../engine/acting-player.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { EngineSessionCore, beginsVillainPhase } from "../engine/session-core.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { headerOf } from "./live-publisher.js";
import { SeatCore } from "./seat-core.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
  seed: 2026,
  watchable: true,
  room: "room00000001",
  roomPlayMode: "host",
};

/** Plays the host's game until its first villain phase is over: decisions declined (or their first option), turns ended. */
async function hostThroughVillainPhase(extra = 0): Promise<{ core: EngineSessionCore; phaseStart: number }> {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  let state: GameState = (await core.start(CONFIG)).snapshot.state as GameState;
  let phaseStart = -1;
  for (let step = 0; step < 200; step++) {
    if (phaseStart >= 0 && state.step.phase !== "villain") {
      if (extra === 0) return { core, phaseStart };
      extra -= 1;
    }
    const choice = state.pendingChoice;
    let tried: Command[] = [];
    if (choice) {
      const answer = (ids: string[]): Command =>
        ({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: ids,
        }) as Command;
      tried = [answer([]), answer(choice.options.slice(0, 1).map((o) => o.optionId))];
    } else {
      const acting = actingPlayer(state) as PlayerId;
      const legal = core.legalActions(acting);
      const end = "legal" in legal ? legal.legal.find((entry) => entry.action.kind === "endTurn") : undefined;
      if (end) tried = [end.example as Command];
    }
    let moved = false;
    for (const command of tried) {
      const before = core.liveGame()!.game.commands.length;
      const result = core.dispatch(command);
      if (!result.ok) continue;
      if (phaseStart < 0 && beginsVillainPhase(result.snapshot.events)) phaseStart = before;
      state = result.snapshot.state as GameState;
      moved = true;
      break;
    }
    if (!moved) throw new Error(`stuck at step ${step}`);
  }
  throw new Error("no villain phase");
}

describe("a seat's catch-up carries its villain phase (#1017)", () => {
  test("a batch of the host's moves through the villain phase comes with each command's table", async () => {
    const { core, phaseStart } = await hostThroughVillainPhase();
    const live = core.liveGame()!.game;
    const seat = new SeatCore();
    seat.open(
      {
        header: headerOf(live),
        commands: live.commands.slice(0, phaseStart),
        checksums: live.checksums ?? {},
        packs: loadedPacks(),
      },
      "open",
    );
    // The rest of the phase lands as one batch, as it does after the guest's connection blips.
    const rest = live.commands.slice(phaseStart);
    expect(rest.length).toBeGreaterThan(1);
    const snapshot = seat.append(rest);
    expect(snapshot.events).toEqual([]);
    const phase = snapshot.villainPhase!;
    expect(phase.startCommand).toBe(phaseStart);
    expect(phase.before.step.phase).not.toBe("villain");
    expect(phase.commands.length).toBe(rest.length);
    expect(phase.commands[0]!.after.step.phase).toBe("villain");
    expect(phase.commands.at(-1)!.after.step.phase).not.toBe("villain");
  });

  test("a single move is published with its own events and no phase", async () => {
    const { core, phaseStart } = await hostThroughVillainPhase();
    const live = core.liveGame()!.game;
    const seat = new SeatCore();
    seat.open(
      { header: headerOf(live), commands: live.commands.slice(0, phaseStart), checksums: {}, packs: loadedPacks() },
      "open",
    );
    const snapshot = seat.append(live.commands.slice(phaseStart, phaseStart + 1));
    expect(snapshot.events.length).toBeGreaterThan(0);
    expect(snapshot.villainPhase).toBeUndefined();
  });

  test("a batch past the phase keeps the phase to the command that left it", async () => {
    const { core, phaseStart } = await hostThroughVillainPhase(1);
    const live = core.liveGame()!.game;
    const seat = new SeatCore();
    seat.open(
      { header: headerOf(live), commands: live.commands.slice(0, phaseStart), checksums: {}, packs: loadedPacks() },
      "open",
    );
    const rest = live.commands.slice(phaseStart);
    const snapshot = seat.append(rest);
    const phase = snapshot.villainPhase!;
    // The last command of the batch is the next player turn's: not part of the phase.
    expect(phase.commands.length).toBe(rest.length - 1);
    expect(phase.commands.at(-1)!.after.step.phase).not.toBe("villain");
  });

  test("a reopened log that ends on the phase carries it, with no event states; a rewind or later turns do not", async () => {
    const { core, phaseStart } = await hostThroughVillainPhase(2);
    const live = core.liveGame()!.game;
    const total = live.commands.length;
    const seat = new SeatCore();
    // A reconnect's whole log, ending on the command that left the phase.
    const ends = total - 2;
    const reopened = seat.open(
      { header: headerOf(live), commands: live.commands.slice(0, ends), checksums: {}, packs: loadedPacks() },
      "reset",
    );
    expect(reopened.snapshot.villainPhase?.startCommand).toBe(phaseStart);
    expect(reopened.snapshot.villainPhase?.commands.every((command) => command.states.length === 0)).toBe(true);
    // Later turns only: nothing of the phase is wanted.
    expect(seat.append(live.commands.slice(ends, total)).villainPhase).toBeUndefined();
    // A rewind never carries it.
    expect(seat.rewind(phaseStart + 1).villainPhase).toBeUndefined();
  });
});
