import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomState } from "../live/room-state.js";
import { clearRoomAddress, roomLinkOf, syncRoomAddress, writeRoomAddress } from "./room-address.js";

function page(hash = "") {
  const location = { hash, pathname: "/play/", search: "?a=1" };
  const log: string[] = [];
  const history = {
    state: null,
    replaceState(_state: unknown, _unused: string, url?: string | URL | null) {
      log.push(String(url));
      location.hash = String(url).includes("#") ? `#${String(url).split("#")[1]}` : "";
    },
  };
  return { location, history, log };
}

const inRoom = (over: Partial<RoomState>): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  ...over,
});

describe("the room in the address", () => {
  it("reads a room code from the hash, any case, without clearing it", () => {
    const p = page("#room=abc-234");
    expect(roomLinkOf(p.location)).toBe("ABC234");
    expect(p.location.hash).toBe("#room=abc-234");
    expect(roomLinkOf(page("#room=!!").location)).toBeNull();
    expect(roomLinkOf(page("#join=ABC234").location)).toBeNull();
    expect(roomLinkOf(page("").location)).toBeNull();
  });

  it.each([
    ["a host hosting", { role: "host" as const, connection: "connecting" as const, code: "ABC234" }],
    ["a guest who typed a code", { role: "guest" as const, connection: "connected" as const, code: "ABC234" }],
    [
      "a guest from a join link or the recent rooms",
      { role: "guest" as const, connection: "reconnecting" as const, code: "ABC234" },
    ],
  ])("writes #room= for %s, replacing the address with no new entry", (_name, state) => {
    const p = page();
    syncRoomAddress(inRoom(state), p.location, p.history);
    expect(p.log).toEqual(["/play/?a=1#room=ABC234"]);
  });

  it("leaves the address alone while the room has no code yet, and does not rewrite the same code", () => {
    const p = page("#room=ABC234");
    syncRoomAddress(inRoom({ connection: "connecting", code: null }), p.location, p.history);
    syncRoomAddress(inRoom({ code: "ABC234" }), p.location, p.history);
    expect(p.log).toEqual([]);
  });

  it("removes it when the room is left or over, and touches no other hash", () => {
    const left = page("#room=ABC234");
    syncRoomAddress(NO_ROOM, left.location, left.history);
    expect(left.log).toEqual(["/play/?a=1"]);
    const over = page("#room=ABC234");
    syncRoomAddress(inRoom({ connection: "ended", problem: "not-found", code: "ABC234" }), over.location, over.history);
    expect(over.log).toEqual(["/play/?a=1"]);
    const other = page("#watch=xyz");
    syncRoomAddress(NO_ROOM, other.location, other.history);
    clearRoomAddress(other.location, other.history);
    expect(other.log).toEqual([]);
  });

  it("writes over a different hash and survives no location", () => {
    const p = page("#watch=x");
    writeRoomAddress("ABC234", p.location, p.history);
    expect(p.location.hash).toBe("#room=ABC234");
    expect(() => syncRoomAddress(NO_ROOM, undefined, undefined)).not.toThrow();
  });
});
