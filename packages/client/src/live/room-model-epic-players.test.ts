import { describe, expect, it } from "vitest";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { RoomModel } from "./room-model.js";

/** Epic seats carry the engine player of their own table (p1.. in seat order within the table, set by the room). */
describe("whose turn it is at an Epic table", () => {
  it("reads each seat's player from the lobby, so a second table's seats map to that table's engine players", () => {
    const model = new RoomModel({
      role: "guest",
      name: "Ava",
      build: { appVersion: "1", contentVersion: "1" },
      linkBase: "https://example.test/",
      roomId: "room",
    });
    model.onMessage({
      v: 1,
      ch: "room",
      kind: "lobby",
      code: "K7M2PQ",
      settings: { mode: "epic", playMode: "host" },
      seats: [
        { id: "s1", label: "H1", table: "t1", player: "p1" },
        { id: "s2", label: "H2", table: "t1", player: "p2" },
        { id: "s3", label: "H3", table: "t2", player: "p1" },
        { id: "s4", label: "H4", table: "t2", player: "p2" },
      ],
    } as unknown as ServerMessage);
    expect(model.state().seats.map((s) => [s.id, s.player])).toEqual([
      ["s1", "p1"],
      ["s2", "p2"],
      ["s3", "p1"],
      ["s4", "p2"],
    ]);
    // The second table's seat 4 is that table's second hero, not a fourth one.
    expect(model.playersOfSeats(["s4"])).toEqual(["p2"]);
    expect(model.playersOfSeats(["s3", "s4"])).toEqual(["p1", "p2"]);
  });
});
