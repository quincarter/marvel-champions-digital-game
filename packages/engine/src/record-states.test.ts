import { describe, expect, it } from "vitest";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { locateCard } from "./query.js";
import type { GameState } from "./state.js";
import { newGame } from "./testing/scenario.js";

const p1 = playerId("p1");

/** Ending p1's turn runs the villain phase inside the one command. */
const endTurn = (state: GameState) => applyCommand(state, { type: "endTurn", playerId: p1 });

describe("ApplyOptions.recordStates (issue #386)", () => {
  it("adds nothing unless asked, and changes nothing about the command when asked", () => {
    const state = newGame();
    const plain = endTurn(state);
    const recorded = applyCommand(state, { type: "endTurn", playerId: p1 }, undefined, { recordStates: () => true });
    if (!plain.ok || !recorded.ok) throw new Error("endTurn failed");
    expect("states" in plain).toBe(false);
    expect(recorded.state).toEqual(plain.state);
    expect(recorded.events).toEqual(plain.events);
  });

  it("keeps the state as it stood when each picked event was emitted, in event order", () => {
    const state = newGame();
    const picked = (event: GameEvent) => event.type === "cardMoved" || event.type === "stepChanged";
    const result = applyCommand(state, { type: "endTurn", playerId: p1 }, undefined, {
      recordStates: (event) => picked(event),
    });
    if (!result.ok) throw new Error("endTurn failed");
    const states = result.states!;
    expect(states.length).toBeGreaterThan(0);
    expect(states.length).toBe(result.events.filter(picked).length);
    expect(states.map((entry) => entry.at)).toEqual([...states.map((entry) => entry.at)].sort((a, b) => a - b));
    for (const { at, state: then } of states) {
      const event = result.events[at]!;
      expect(picked(event)).toBe(true);
      // The move the event reports has happened in its own state.
      if (event.type === "cardMoved") expect(locateCard(then, event.instanceId)).toEqual(event.to);
      if (event.type === "stepChanged") expect(then.step).toEqual(event.to);
    }
  });
});
