import { describe, expect, test } from "vitest";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig, VillainPhaseSeed } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import {
  clearVillainPhaseMarker,
  readVillainPhaseMarker,
  seedVersionOf,
  villainPhaseToRebuild,
  walkthroughFromSeed,
  writeVillainPhaseMarker,
} from "./villain-phase-resume.js";

/** A Storage stand-in: just the three calls the marker uses. */
function fakeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

describe("the open walkthrough's marker", () => {
  test("is set, read back and cleared", () => {
    const storage = fakeStorage();
    expect(readVillainPhaseMarker(storage)).toBeNull();
    writeVillainPhaseMarker({ gameId: "g1", commandCount: 3 }, storage);
    expect(readVillainPhaseMarker(storage)).toEqual({ gameId: "g1", commandCount: 3 });
    clearVillainPhaseMarker(storage);
    expect(readVillainPhaseMarker(storage)).toBeNull();
  });

  test("ignores a note that is not one this build wrote", () => {
    const storage = fakeStorage();
    const notes = [
      "nope",
      "[]",
      "null",
      JSON.stringify({ gameId: 1, commandCount: 2 }),
      JSON.stringify({ gameId: "g", commandCount: -1 }),
    ];
    for (const raw of notes) {
      storage.items.set("mc-villain-phase-open", raw);
      expect(readVillainPhaseMarker(storage)).toBeNull();
    }
  });

  test("never throws when storage is missing or blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => writeVillainPhaseMarker({ gameId: "g", commandCount: 1 }, blocked)).not.toThrow();
    expect(readVillainPhaseMarker(blocked)).toBeNull();
    expect(() => clearVillainPhaseMarker(blocked)).not.toThrow();
    expect(() => writeVillainPhaseMarker({ gameId: "g", commandCount: 1 }, null)).not.toThrow();
  });
});

const isPhaseStart = (events: readonly { readonly type: string }[]): boolean =>
  events.some((event) => {
    const e = event as { type: string; to?: { phase?: string; kind?: string } };
    return e.type === "stepChanged" && e.to?.phase === "villain" && e.to.kind === "placeThreat";
  });

/** A game played until a command begins the villain phase, saved, and resumed on a fresh host: the reload. */
async function reloadedMidPhase(): Promise<{
  readonly played: SessionStore;
  readonly reloaded: SessionStore;
  readonly id: string;
}> {
  const storage = new MemoryGameStorage();
  const host = new LocalEngineHost(storage);
  const played = new SessionStore(host);
  await played.start(RHINO_SOLO);
  for (let step = 0; step < 12 && played.state.commandTrail.every((entry) => !isPhaseStart(entry.events)); step++) {
    const { legal } = played.state;
    if (legal?.actions.kind === "choice") {
      const { choice } = legal.actions;
      await played.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    } else if (legal?.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await played.dispatch(end.example);
    } else break;
  }
  await host.flushed();
  const id = (await played.latestSave())!.id;
  const reloaded = new SessionStore(new LocalEngineHost(storage));
  await reloaded.resume(id, { sync: false });
  return { played, reloaded, id };
}

describe("a villain phase rebuilt from a save", () => {
  test("the resume carries the table before the command that began the phase, and the commands from there", async () => {
    const { played, reloaded } = await reloadedMidPhase();
    const trail = played.state.commandTrail;
    const startCommand = trail.findIndex((entry) => isPhaseStart(entry.events));
    expect(startCommand).toBeGreaterThanOrEqual(0);

    const seed = reloaded.state.resumedVillainPhase;
    expect(seed).not.toBeNull();
    expect(seed!.startCommand).toBe(startCommand);
    expect(seedVersionOf(seed!)).toBe(reloaded.state.version);
    // The events are the save's own, command by command, from the one that began the phase.
    expect(seed!.commands.map((command) => command.events)).toEqual(trail.slice(startCommand).map((e) => e.events));
    expect(isPhaseStart(seed!.commands[0]!.events)).toBe(true);
    // `before` is the table as the beginning command found it: still the player phase, with its card pool attached.
    expect(seed!.before.step.phase).toBe("player");
    expect(Object.keys(seed!.before.cardPool).length).toBeGreaterThan(0);
    // The last command's table is the resumed game's own.
    expect(seed!.commands.at(-1)!.after).toEqual(reloaded.state.game);
  }, 60_000);

  test("rebuilds the walkthrough a live phase would have had", async () => {
    const { reloaded } = await reloadedMidPhase();
    const seed = reloaded.state.resumedVillainPhase!;
    const walkthrough = walkthroughFromSeed(seed, 1, undefined, reloaded.state.perspectiveId);
    const beats = walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);
    expect(beats).toBeGreaterThan(0);
  }, 60_000);

  test("is only rebuilt for the game and the command the marker names", async () => {
    const { reloaded, id } = await reloadedMidPhase();
    const seed = reloaded.state.resumedVillainPhase as VillainPhaseSeed;
    const marker = { gameId: id, commandCount: seed.startCommand };
    expect(villainPhaseToRebuild(marker, id, seed)).toBe(seed);
    expect(villainPhaseToRebuild(null, id, seed)).toBeNull();
    expect(villainPhaseToRebuild(marker, "another", seed)).toBeNull();
    expect(villainPhaseToRebuild(marker, null, seed)).toBeNull();
    expect(villainPhaseToRebuild({ ...marker, commandCount: seed.startCommand + 1 }, id, seed)).toBeNull();
    expect(villainPhaseToRebuild(marker, id, null)).toBeNull();
  }, 60_000);
});
