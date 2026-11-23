import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomState } from "../live/room-state.js";
import { fakePage } from "./address-page.js";
import { clearRoomAddress, roomLinkOf, syncRoomAddress, writeRoomAddress } from "./room-address.js";

const inRoom = (over: Partial<RoomState>): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  ...over,
});

describe("the room in the address", () => {
  it("reads a room code from ?room=, any case, without clearing it", () => {
    const p = fakePage("/play/?room=abc-234");
    expect(roomLinkOf(p.location)).toBe("ABC234");
    expect(p.url()).toBe("/play/?room=abc-234");
    expect(roomLinkOf(fakePage("/?room=!!").location)).toBeNull();
    expect(roomLinkOf(fakePage("/#join=ABC234").location)).toBeNull();
    expect(roomLinkOf(fakePage("/").location)).toBeNull();
  });

  it.each([
    ["a host hosting", { role: "host" as const, connection: "connecting" as const, code: "ABC234" }],
    ["a guest who typed a code", { role: "guest" as const, connection: "connected" as const, code: "ABC234" }],
    [
      "a guest from a join link or the recent rooms",
      { role: "guest" as const, connection: "reconnecting" as const, code: "ABC234" },
    ],
  ])("sets ?room= for %s, replacing the address with no new entry and keeping other params", (_name, state) => {
    const p = fakePage("/play/?a=1");
    syncRoomAddress(inRoom(state), p.location, p.history);
    expect(p.log).toEqual(["/play/?a=1&room=ABC234"]);
  });

  it("keeps a dev ?screen= jump and the hash beside it", () => {
    const p = fakePage("/?screen=online#x");
    writeRoomAddress("ABC234", p.location, p.history);
    expect(p.url()).toBe("/?screen=online&room=ABC234#x");
  });

  it("leaves the address alone while the room has no code yet, and does not rewrite the same code", () => {
    const p = fakePage("/?room=ABC234");
    syncRoomAddress(inRoom({ connection: "connecting", code: null }), p.location, p.history);
    syncRoomAddress(inRoom({ code: "ABC234" }), p.location, p.history);
    expect(p.log).toEqual([]);
  });

  it("removes it when the room is left or over, and touches no other param", () => {
    const left = fakePage("/?a=1&room=ABC234");
    syncRoomAddress(NO_ROOM, left.location, left.history);
    expect(left.log).toEqual(["/?a=1"]);
    const over = fakePage("/?room=ABC234");
    syncRoomAddress(inRoom({ connection: "ended", problem: "not-found", code: "ABC234" }), over.location, over.history);
    expect(over.log).toEqual(["/"]);
    const other = fakePage("/?watch=xyz");
    syncRoomAddress(NO_ROOM, other.location, other.history);
    clearRoomAddress(other.location, other.history);
    expect(other.log).toEqual([]);
  });

  it("takes the other place params out when a room is entered, and survives no location", () => {
    const p = fakePage("/?game=abc");
    writeRoomAddress("ABC234", p.location, p.history);
    expect(p.url()).toBe("/?room=ABC234");
    expect(() => syncRoomAddress(NO_ROOM, undefined, undefined)).not.toThrow();
  });
});
