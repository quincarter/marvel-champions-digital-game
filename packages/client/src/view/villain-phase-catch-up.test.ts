import type { GameEvent, GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { commandsToTakeIn, gamesForTakeIn, type CatchUpSource } from "./villain-phase-catch-up.js";

const ev = (n: number): GameEvent => ({ type: "threatPlaced", amount: n }) as unknown as GameEvent;
const table = (round: number, tag = "end"): GameState => ({ round, tag }) as unknown as GameState;
const trailOf = (count: number) => Array.from({ length: count }, (_, i) => ({ events: [ev(i)] }));
const source = (over: Partial<CatchUpSource>): CatchUpSource => ({
  version: 5,
  game: table(3),
  lastEvents: [],
  lastStates: [],
  commandTrail: trailOf(5),
  resumedVillainPhase: null,
  ...over,
});
const eventsOf = (taken: ReturnType<typeof commandsToTakeIn>) => taken.map((command) => command.events);

describe("commandsToTakeIn (#1017)", () => {
  it("takes an update's own events when the screen has seen nothing yet", () => {
    expect(eventsOf(commandsToTakeIn(-2, source({ lastEvents: [ev(4)] })))).toEqual([[ev(4)]]);
  });

  it("takes one command's events, table and event states as they come", () => {
    const states = [{ at: 0, state: table(3, "mid") }];
    const [only] = commandsToTakeIn(4, source({ lastEvents: [ev(99)], lastStates: states, commandTrail: trailOf(4) }));
    expect(only).toEqual({ events: [ev(99)], after: table(3), states });
  });

  it("takes every command a guest's catch-up batch skipped, from the trail, in order", () => {
    // A batch of three of the host's moves lands as one update with no events of its own (live/seat-core.ts).
    expect(eventsOf(commandsToTakeIn(4, source({ version: 7, commandTrail: trailOf(7) })))).toEqual([
      [ev(4)],
      [ev(5)],
      [ev(6)],
    ]);
  });

  it("takes a single missed command from the trail when the update carries no events (a reconnect's log)", () => {
    expect(eventsOf(commandsToTakeIn(4, source({})))).toEqual([[ev(4)]]);
  });

  it("falls back to the update's own events on a rewind or a trail that does not line up with the update", () => {
    const rewind = source({ version: 4, lastEvents: [ev(3)], commandTrail: trailOf(4) });
    expect(eventsOf(commandsToTakeIn(6, rewind))).toEqual([[ev(3)]]);
    expect(eventsOf(commandsToTakeIn(4, source({ version: 7, commandTrail: trailOf(5) })))).toEqual([[]]);
    // One entry long reads every index one command off: never trusted.
    expect(eventsOf(commandsToTakeIn(4, source({ commandTrail: trailOf(6) })))).toEqual([[]]);
  });

  it("replays the catch-up's villain phase with the table each command left, and its recap baseline", () => {
    // The phase began at command 5; the screen had seen 4 commands, so it missed command 4 (before the phase) and 5–6.
    const before = table(3, "before");
    const phase = {
      startCommand: 5,
      before,
      commands: [
        { events: [ev(50)], states: [{ at: 0, state: table(3, "threat") }], after: table(3, "after 5") },
        { events: [ev(60)], states: [], after: table(3, "after 6") },
      ],
    };
    const taken = commandsToTakeIn(4, source({ version: 7, commandTrail: trailOf(7), resumedVillainPhase: phase }));
    expect(eventsOf(taken)).toEqual([[ev(4)], [ev(50)], [ev(60)]]);
    expect(taken.map((command) => (command.after as unknown as { tag: string }).tag)).toEqual([
      "end",
      "after 5",
      "after 6",
    ]);
    expect(taken[1]?.states).toEqual(phase.commands[0]?.states);
    expect(taken.map((command) => command.phaseBefore ?? null)).toEqual([null, before, null]);
  });
});

describe("gamesForTakeIn", () => {
  it("winds an earlier command's table back by the rounds the later commands started", () => {
    const game = table(3);
    const started = { type: "roundStarted", round: 3 } as unknown as GameEvent;
    const tables = gamesForTakeIn([[ev(0)], [started], [ev(1)]], game);
    expect(tables.map((t) => t.round)).toEqual([2, 3, 3]);
    expect(tables[2]).toBe(game);
  });
});
