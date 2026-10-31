import type { GameState, InstanceId, PendingChoice } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { optionCounterNotesOf, tileCounterNote } from "./choice-tile-notes.js";

const game = {
  instances: {
    a: { instanceId: "a", cardId: "27044", counters: { backup: 3 }, zone: { kind: "playArea", playerId: "p1" } },
    b: { instanceId: "b", cardId: "27044", counters: { backup: 1 }, zone: { kind: "playArea", playerId: "p1" } },
  },
} as unknown as GameState;

const option = (id: string) => ({
  optionId: id,
  label: "Field Agent",
  ref: { kind: "ability", instanceId: id as InstanceId, abilityId: "27044.field-agent-interrupt" },
});

describe("two copies of a Uses card (issue #571)", () => {
  test("a tile fits the short form of the note", () => {
    expect(tileCounterNote("1 backup counter")).toBe("1 backup");
    expect(tileCounterNote("2 backup counters")).toBe("2 backup");
  });

  test("a divided or ordered prompt has no notes", () => {
    const choice = { prompt: { kind: "divide" }, options: [option("a"), option("b")] } as unknown as PendingChoice;
    expect(optionCounterNotesOf(game, choice).size).toBe(0);
  });
});
