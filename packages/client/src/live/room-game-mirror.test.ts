import { describe, expect, it } from "vitest";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { GameMirror } from "./room-game-mirror.js";

const msg = (m: object): ServerMessage => ({ v: 1, ch: "game", table: "t1", ...m }) as ServerMessage;
const kinds = (mirror: GameMirror) => mirror.snapshot().map((m) => (m as { kind: string }).kind);

const endedMirror = () => {
  const mirror = new GameMirror();
  mirror.apply(msg({ kind: "log", header: { h: 1 }, commands: [1, 2, 3], checksums: {} }));
  mirror.apply(msg({ kind: "end", outcome: { won: true } }));
  return mirror;
};

describe("GameMirror and a finished game that is reopened", () => {
  it("a finished game snapshots as a log with its outcome and an end", () => {
    expect(kinds(endedMirror())).toEqual(["log", "end"]);
  });

  it("a rewind to the current count reopens it: a guest attaching afterwards gets no outcome and no end", () => {
    const mirror = endedMirror();
    expect(mirror.apply(msg({ kind: "rewind", to: 3 }))).toBe("applied");
    const snapshot = mirror.snapshot();
    expect(kinds(mirror)).toEqual(["log"]);
    expect(snapshot[0]).not.toHaveProperty("outcome");
    expect(mirror.count).toBe(3);
  });

  it("a rewind to the current count of an open game changes nothing, and one past the end is ignored", () => {
    const mirror = new GameMirror();
    mirror.apply(msg({ kind: "log", header: 1, commands: [1, 2], checksums: {} }));
    expect(mirror.apply(msg({ kind: "rewind", to: 2 }))).toBe("ignored");
    expect(mirror.apply(msg({ kind: "rewind", to: 5 }))).toBe("ignored");
  });

  it("a batch after the end clears it too", () => {
    const mirror = endedMirror();
    mirror.apply(msg({ kind: "commands", from: 3, commands: [4] }));
    expect(kinds(mirror)).toEqual(["log"]);
    expect(mirror.count).toBe(4);
    mirror.apply(msg({ kind: "end", outcome: { won: false } }));
    expect(kinds(mirror)).toEqual(["log", "end"]);
  });
});
