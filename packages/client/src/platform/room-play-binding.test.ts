import { describe, expect, test } from "vitest";
import type { RoomPlayTracker } from "../live/room-play-tracker.js";
import { RoomPlayBindings } from "./room-play-binding.js";

const tracker = (over: Partial<RoomPlayTracker> = {}): RoomPlayTracker =>
  ({ roomId: "R", table: "main", gameKey: "R:main:g1", confirmed: true, ...over }) as RoomPlayTracker;

describe("RoomPlayBindings", () => {
  test("a late update of room game A resolves to A's save even after the session moved to local game B", () => {
    const bindings = new RoomPlayBindings<string>();
    const a = tracker();
    bindings.advance(null, a);
    // The session was game A when the room game started.
    expect(bindings.resolve("R", "main", () => ({ gameId: "save-A", owner: "host-A" }))).toMatchObject({
      gameId: "save-A",
      owner: "host-A",
    });
    bindings.advance(a, a);
    // The app is now in local game B; A's late update still goes to A.
    const late = bindings.resolve("R", "main", () => ({ gameId: "save-B", owner: "host-B" }));
    expect(late).toMatchObject({ gameId: "save-A", owner: "host-A" });
  });

  test("a record of another room or table is never bound to this save", () => {
    const bindings = new RoomPlayBindings<string>();
    bindings.advance(null, tracker());
    bindings.resolve("R", "main", () => ({ gameId: "save-A", owner: "h" }));
    expect(bindings.resolve("OTHER", "main", () => ({ gameId: "save-B", owner: "h" }))).toBeNull();
    expect(bindings.resolve("R", "t2", () => ({ gameId: "save-B", owner: "h" }))).toBeNull();
  });

  test("another game, or a promoted key of the same game, is told apart", () => {
    const bindings = new RoomPlayBindings<string>();
    const provisional = tracker({ gameKey: "R:5", confirmed: false });
    bindings.advance(null, provisional);
    bindings.resolve("R", "main", () => ({ gameId: "save-A", owner: "h" }));
    const promoted = tracker({ gameKey: "R:main:g1", confirmed: true });
    bindings.advance(provisional, promoted);
    expect(bindings.current?.gameId).toBe("save-A");
    bindings.advance(promoted, tracker({ gameKey: "R:main:g2", confirmed: true }));
    expect(bindings.current).toBeNull();
    expect(bindings.resolve("R", "main", () => ({ gameId: "save-C", owner: "h" }))?.gameId).toBe("save-C");
  });

  test("a rematch of the same room (another gid) is not bound to the first game save", () => {
    const bindings = new RoomPlayBindings<string>();
    bindings.advance(null, tracker());
    bindings.resolve("R", "main", () => ({ gameId: "save-A", owner: "h" }));
    // The binding learns the gid when the room tells it, then refuses another.
    expect(bindings.resolve("R", "main", () => ({ gameId: "x", owner: "h" }), "g1")?.gid).toBe("g1");
    expect(bindings.resolve("R", "main", () => ({ gameId: "save-B", owner: "h" }), "g2")).toBeNull();
    expect(bindings.resolve("R", "main", () => ({ gameId: "save-B", owner: "h" }))).toBeNull();
  });

  test("with no save yet nothing is bound, and the finished game's binding is kept until released", () => {
    const bindings = new RoomPlayBindings<string>();
    bindings.advance(null, tracker());
    expect(bindings.resolve("R", "main", () => ({ gameId: null, owner: "h" }))).toBeNull();
    bindings.resolve("R", "main", () => ({ gameId: "save-A", owner: "h" }));
    bindings.advance(tracker(), null);
    expect(bindings.current?.gameId).toBe("save-A");
    bindings.release();
    expect(bindings.current).toBeNull();
  });
});
