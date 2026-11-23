/**
 * Every way into a room puts `#room=<CODE>` in the address, and leaving or losing the room takes it out: the calls the
 * Play online screen makes (host, typed code, a `#join=` or deep link, a recent room, a reload's rejoin), with the room
 * worker stood in for by a function that answers with the state the real one would post.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveRoomIn } from "../live/live-room-protocol.js";
import { NO_ROOM, type RoomState } from "../live/room-state.js";

const posted: LiveRoomIn[] = [];
let toRoom: (state: RoomState) => void = () => undefined;

vi.mock("./live-watch.js", () => ({
  postRoomCommand: (message: LiveRoomIn) => {
    posted.push(message);
    return true;
  },
  setRoomStateListener: (listener: (state: RoomState) => void) => {
    toRoom = listener;
  },
  setChatPopoutListener: () => undefined,
  setRoomDecksListener: () => undefined,
}));
const session = { settings: { onlineName: "Pat" } };
vi.mock("../session.js", () => ({ appSession: () => session }));

const location = { hash: "", pathname: "/", search: "" };

beforeEach(() => {
  posted.length = 0;
  location.hash = "";
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", {
    state: null,
    replaceState: (_s: unknown, _u: string, url: string) => {
      location.hash = url.includes("#") ? `#${url.split("#")[1]}` : "";
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const room = (over: Partial<RoomState>): RoomState => ({
  ...NO_ROOM,
  connection: "connected",
  code: "ABC234",
  ...over,
});

describe("#room= follows every way into a room", () => {
  it("hosting a room", async () => {
    const { hostRoom } = await import("./room.js");
    await hostRoom("Pat");
    expect(location.hash).toBe("");
    toRoom(room({ role: "host" }));
    expect(location.hash).toBe("#room=ABC234");
  });

  it.each(["typed code", "a #join= link or deep link", "a recent room"])("joining by %s", async () => {
    const { joinRoom, roomState } = await import("./room.js");
    await joinRoom("ABC234", "Pat");
    expect(posted.at(-1)).toMatchObject({ kind: "room-join", target: "ABC234" });
    toRoom(room({ role: "guest", connection: "connecting" }));
    toRoom(room({ role: "guest" }));
    expect(location.hash).toBe("#room=ABC234");
    expect(roomState().code).toBe("ABC234");
  });

  it("a reload's rejoin keeps the hash, and a room that is gone clears it", async () => {
    const { rejoinRoom } = await import("./room.js");
    location.hash = "#room=ABC234";
    await rejoinRoom("ABC234");
    expect(posted.at(-1)).toMatchObject({ kind: "room-rejoin", code: "ABC234", name: "Pat" });
    expect(location.hash).toBe("#room=ABC234");
    toRoom(room({ role: "guest", connection: "ended", problem: "not-found" }));
    expect(location.hash).toBe("");
  });

  it("leaving the room clears it", async () => {
    const { leaveRoom } = await import("./room.js");
    toRoom(room({ role: "host" }));
    expect(location.hash).toBe("#room=ABC234");
    leaveRoom({ closeRoom: true });
    expect(location.hash).toBe("");
  });
});
