import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import { handVisibleTo, hostSeesHandsOf, type HandPrivacy } from "./hand-privacy.js";

const seat = (over: Partial<RoomSeat> = {}): RoomSeat => ({
  id: "s1",
  label: "Spider-Man",
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
const participant = { id: "h", name: "Mara", role: "host" as const, me: false, buildMatches: true, seats: [] };
const room = (role: "host" | "guest", seats: RoomSeat[], hostSeesHands = false): RoomState => ({
  ...NO_ROOM,
  role,
  connection: "connected",
  participants: [participant],
  seats,
  settings: {
    playMode: "host",
    undo: "ask",
    cheats: false,
    tableRules: {},
    mods: [],
    multiSeat: false,
    chat: true,
    contentVersion: "",
    appVersion: "",
    hostSeesHands,
  },
});
const privacy = (r: RoomState | null, extra: Partial<HandPrivacy> = {}): HandPrivacy => ({
  room: r,
  watching: false,
  handsHidden: false,
  ...extra,
});

const hostSeats = [seat({ mine: true }), seat({ id: "s2", player: "p2", holder: "g", holderName: "Ava" })];
const guestSeats = [seat({ mine: false }), seat({ id: "s2", player: "p2", mine: true, holderName: "Ava" })];

describe("handVisibleTo", () => {
  it("the host sees its own hand face up and a guest's face down", () => {
    const p = privacy(room("host", hostSeats));
    expect(handVisibleTo(p, "p1")).toBe(true);
    expect(handVisibleTo(p, "p2")).toBe(false);
  });

  it("a guest sees its own hand and not the host's", () => {
    const p = privacy(room("guest", guestSeats));
    expect(handVisibleTo(p, "p2")).toBe(true);
    expect(handVisibleTo(p, "p1")).toBe(false);
  });

  it("a seat the host took over shows face up on the host's board", () => {
    const taken = [seat({ mine: true }), seat({ id: "s2", player: "p2", holder: "g", takenOver: true })];
    expect(handVisibleTo(privacy(room("host", taken)), "p2")).toBe(true);
  });

  it("a guest keeps sight of its own hand when its seat was taken over, is away or is on another build", () => {
    for (const over of [{ takenOver: true }, { away: true }, { mismatch: true }]) {
      const mine = [seat({ mine: true, ...over, player: "p1" }), seat({ id: "s2", player: "p2", holder: "h" })];
      expect(handVisibleTo(privacy(room("guest", mine)), "p1")).toBe(true);
      expect(handVisibleTo(privacy(room("guest", mine)), "p2")).toBe(false);
    }
  });

  it("a hero with no seat is the host's to see and not a guest's", () => {
    const seats = [seat({ player: "p1", mine: true })];
    expect(handVisibleTo(privacy(room("host", seats)), "p9")).toBe(true);
    expect(handVisibleTo(privacy(room("guest", seats)), "p9")).toBe(false);
  });

  it("a guest's turn does not turn its hand face up on the host's board", () => {
    // The shown seat follows the acting one (p2, a guest's): its hand stays face down.
    expect(handVisibleTo(privacy(room("host", hostSeats)), "p2")).toBe(false);
  });

  it("host sees every hand: on shows all for the host, never for a guest", () => {
    expect(handVisibleTo(privacy(room("host", hostSeats, true)), "p2")).toBe(true);
    expect(handVisibleTo(privacy(room("guest", guestSeats, true)), "p1")).toBe(false);
  });

  it("single player, and one person playing every seat, see every hand", () => {
    expect(handVisibleTo(privacy(null), "p2")).toBe(true);
    expect(handVisibleTo(privacy(NO_ROOM), "p2")).toBe(true);
    // A room whose seats are not mapped to heroes yet is not a room game.
    expect(handVisibleTo(privacy(room("host", [seat({ player: null })])), "p1")).toBe(true);
  });

  it("a watcher sees no hand face up unless the game says its hands are open", () => {
    expect(handVisibleTo(privacy(null, { watching: true, handsHidden: true }), "p1")).toBe(false);
    expect(handVisibleTo(privacy(null, { watching: true, handsHidden: false }), "p1")).toBe(true);
  });

  it("reads the lobby toggle, off unless switched on", () => {
    expect(hostSeesHandsOf({ settings: null })).toBe(false);
    expect(hostSeesHandsOf(room("host", [], false))).toBe(false);
    expect(hostSeesHandsOf(room("host", [], true))).toBe(true);
  });
});
