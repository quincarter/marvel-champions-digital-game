import { describe, expect, it } from "vitest";
import type { PlayerId } from "@mc/engine";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import { narrationViewer } from "./seat-gate.js";

const seat = (over: Partial<RoomSeat> = {}): RoomSeat => ({
  id: "s1",
  label: "Spider-Man (Justice) - Core Set deck",
  holder: "h",
  holderName: "Mara",
  holderConnected: true,
  mismatch: false,
  mine: false,
  player: "p1",
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
  deck: null,
  deckProblem: null,
  ...over,
});
const p = (id: string): PlayerId => id as PlayerId;

// A host (Spider-Man, p1) and two guests: Ava (Captain Marvel, p2, this device) and Bea (Iron Man, p3).
const guestRoom: RoomState = {
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  seats: [
    seat(),
    seat({ id: "s2", player: "p2", holder: "g1", holderName: "Ava", mine: true }),
    seat({ id: "s3", player: "p3", holder: "g2", holderName: "Bea" }),
  ],
};

describe("narrationViewer (#1017)", () => {
  it("reads another seat's decision through this device's own hero, not as 'you'", () => {
    expect(narrationViewer(guestRoom, p("p1"), true)).toBe("p2");
    expect(narrationViewer(guestRoom, p("p3"), true)).toBe("p2");
  });

  it("keeps the perspective when the hero on screen is this device's own", () => {
    expect(narrationViewer(guestRoom, p("p2"), true)).toBe("p2");
  });

  it("reads a guest's decision on the host's screen through the host's own hero", () => {
    const hostRoom: RoomState = {
      ...guestRoom,
      role: "host",
      seats: guestRoom.seats.map((s) => ({ ...s, mine: s.id === "s1" })),
    };
    expect(narrationViewer(hostRoom, p("p2"), false)).toBe("p1");
  });

  it("changes nothing in single player", () => {
    expect(narrationViewer(null, p("p1"), false)).toBe("p1");
    expect(narrationViewer(guestRoom, null, true)).toBeNull();
  });
});
