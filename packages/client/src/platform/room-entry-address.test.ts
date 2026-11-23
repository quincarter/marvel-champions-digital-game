/**
 * Every way into a room puts `?room=<CODE>` in the address, and leaving or losing the room takes it out: the calls the
 * Play online screen makes (host, typed code, a `#join=` or deep link, a recent room, a reload's rejoin), with the room
 * worker stood in for by a function that answers with the state the real one would post.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveRoomIn } from "../live/live-room-protocol.js";
import { fakePage } from "./address-page.js";
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

let page = fakePage("/");

beforeEach(() => {
  posted.length = 0;
  page = fakePage("/");
  vi.stubGlobal("location", page.location);
  vi.stubGlobal("history", page.history);
});
afterEach(() => vi.unstubAllGlobals());

const room = (over: Partial<RoomState>): RoomState => ({
  ...NO_ROOM,
  connection: "connected",
  code: "ABC234",
  ...over,
});

describe("?room= follows every way into a room", () => {
  it("hosting a room", async () => {
    const { hostRoom } = await import("./room.js");
    await hostRoom("Pat");
    expect(page.url()).toBe("/");
    toRoom(room({ role: "host" }));
    expect(page.url()).toBe("/?room=ABC234");
  });

  it.each(["typed code", "a #join= link or deep link", "a recent room"])("joining by %s", async () => {
    const { joinRoom, roomState } = await import("./room.js");
    await joinRoom("ABC234", "Pat");
    expect(posted.at(-1)).toMatchObject({ kind: "room-join", target: "ABC234" });
    toRoom(room({ role: "guest", connection: "connecting" }));
    toRoom(room({ role: "guest" }));
    expect(page.url()).toBe("/?room=ABC234");
    expect(roomState().code).toBe("ABC234");
  });

  it("a reload's rejoin keeps the hash, and a room that is gone clears it", async () => {
    const { rejoinRoom } = await import("./room.js");
    page = fakePage("/?room=ABC234");
    vi.stubGlobal("location", page.location);
    vi.stubGlobal("history", page.history);
    await rejoinRoom("ABC234");
    expect(posted.at(-1)).toMatchObject({ kind: "room-rejoin", code: "ABC234", name: "Pat" });
    expect(page.url()).toBe("/?room=ABC234");
    toRoom(room({ role: "guest", connection: "ended", problem: "not-found" }));
    expect(page.url()).toBe("/");
  });

  it("leaving the room clears it", async () => {
    const { leaveRoom } = await import("./room.js");
    toRoom(room({ role: "host" }));
    expect(page.url()).toBe("/?room=ABC234");
    leaveRoom({ closeRoom: true });
    expect(page.url()).toBe("/");
  });
});
