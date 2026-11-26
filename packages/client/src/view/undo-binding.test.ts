import type { Command } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { bindUndo, boundUndoMatches, movesFingerprint } from "./undo-binding.js";

const move = (type: string, playerId = "p2", extra: Record<string, unknown> = {}): { command: Command } => ({
  command: { type, playerId, ...extra } as unknown as Command,
});

describe("a guest's bound Each player Undo (#1019 review)", () => {
  const trail = [move("endTurn", "p1"), move("changeForm"), move("basicThwart", "p2", { target: "i9" })];

  it("matches the host's table when it holds the very history the guest saw", () => {
    const bound = bindUndo(trail, 3, 2)!;
    expect(boundUndoMatches(trail, 3, 2, bound)).toBe(true);
  });

  it("refuses a newer move of the guest's that reached the host first", () => {
    const bound = bindUndo(trail, 3, 2)!;
    const newer = [...trail, move("basicRecover")];
    expect(boundUndoMatches(newer, 4, 3, bound)).toBe(false);
  });

  it("refuses a queued Undo across a rewind that came back to the same count with other moves", () => {
    const bound = bindUndo(trail, 3, 2)!;
    // The host rewound to 2 and the guest's hero thwarted another target: the same count, a different history.
    const rewritten = [...trail.slice(0, 2), move("basicThwart", "p2", { target: "i7" })];
    expect(boundUndoMatches(rewritten, 3, 2, bound)).toBe(false);
  });

  it("reads the same command written with its keys in another order as the same move", () => {
    const a = { type: "basicThwart", playerId: "p2", target: "i9" } as unknown as Command;
    const b = { target: "i9", playerId: "p2", type: "basicThwart" } as unknown as Command;
    expect(movesFingerprint([a])).toBe(movesFingerprint([b]));
    expect(movesFingerprint([a])).not.toBe(movesFingerprint([{ ...a, target: "i7" } as unknown as Command]));
  });

  it("binds nothing for a trail that does not line up with the table", () => {
    expect(bindUndo(trail, 4, 2)).toBeNull();
    expect(bindUndo(trail, 3, 4)).toBeNull();
  });
});
