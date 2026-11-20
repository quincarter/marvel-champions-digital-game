import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import { heldElsewhere } from "./seat-gate.js";
import { actingOf, heroNameOf, hostAwayOf, whoseTurnOf } from "./whose-turn.js";

const seat = (over: Partial<RoomSeat> = {}): RoomSeat => ({
  id: "s1",
  label: "Spider-Man (Justice) - Core Set deck",
  holder: "g1",
  holderName: "Ava",
  holderConnected: true,
  mismatch: false,
  mine: false,
  player: "p1",
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
  ...over,
});
const host = { id: "h", name: "Mara", role: "host" as const, me: false, buildMatches: true, seats: [] };
const room = (over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  participants: [host],
  seats: [seat({ mine: true }), seat({ id: "s2", player: "p2", holder: "h", holderName: "Mara", label: "She-Hulk" })],
  ...over,
});
const turn = (playerId: string) => ({ playerId, kind: "turn" as const });
const choice = (playerId: string) => ({ playerId, kind: "choice" as const });

describe("whoseTurnOf", () => {
  it("says nothing outside a room game", () => {
    expect(whoseTurnOf(NO_ROOM, turn("p1"))).toBeNull();
    expect(whoseTurnOf(room({ seats: [seat({ player: null })] }), turn("p1"))).toBeNull();
  });

  it("is 'Your turn' or 'Your choice' when it is mine", () => {
    expect(whoseTurnOf(room({ seats: [seat({ mine: true })] }), turn("p1"))).toMatchObject({
      key: "turn.yourTurn",
      tone: "mine",
    });
    expect(whoseTurnOf(room({ seats: [seat({ mine: true })] }), choice("p1"))?.key).toBe("turn.yourChoice");
  });

  it("names the hero when I hold several", () => {
    const both = room({ seats: [seat({ mine: true }), seat({ id: "s2", player: "p2", mine: true })] });
    expect(whoseTurnOf(both, turn("p2"))).toMatchObject({ key: "turn.yourTurnHero", params: { hero: "Spider-Man" } });
  });

  it("names whose turn it is when it is another seat's", () => {
    expect(whoseTurnOf(room(), turn("p2"))).toMatchObject({
      key: "turn.theirTurn",
      params: { name: "Mara", hero: "She-Hulk" },
      tone: "other",
    });
    expect(whoseTurnOf(room(), choice("p2"))?.key).toBe("turn.waiting");
  });

  it("says a seat is away, or that the host plays for it", () => {
    const away = room({ seats: [seat({ holder: "g2", holderName: "Bo", away: true, holderConnected: false })] });
    expect(whoseTurnOf(away, turn("p1"))).toMatchObject({ key: "turn.away", tone: "away", params: { name: "Bo" } });
    const taken = room({ seats: [seat({ holderName: "Bo", away: true, takenOver: true })] });
    expect(whoseTurnOf(taken, turn("p1"))?.key).toBe("turn.hostPlays");
  });

  it("says a vacated seat has no player", () => {
    const vacated = room({ seats: [seat({ holder: null, holderName: null })] });
    expect(whoseTurnOf(vacated, turn("p1"))).toMatchObject({ key: "turn.vacant", params: { hero: "Spider-Man" } });
  });

  it("says the host is away for a guest, whatever the turn", () => {
    const gone = room({ participants: [] });
    expect(hostAwayOf(gone)).toBe(true);
    expect(whoseTurnOf(gone, null)?.key).toBe("turn.hostAway");
    expect(whoseTurnOf(gone, turn("p2"))?.key).toBe("turn.hostAway");
  });

  it("is silent between decisions", () => {
    expect(whoseTurnOf(room(), null)).toBeNull();
  });

  it("works for the host acting on a seat it took over", () => {
    const hostRoom = room({
      role: "host",
      participants: [{ ...host, me: true }],
      seats: [seat({ holderName: "Bo", away: true, takenOver: true })],
    });
    expect(whoseTurnOf(hostRoom, turn("p1"))).toMatchObject({ key: "turn.yourTurnHero", tone: "mine" });
  });
});

describe("actingOf", () => {
  it("reads a pending choice before the turn", () => {
    const game = {
      outcome: null,
      pendingChoice: { playerId: "p2" },
      step: { phase: "player", kind: "turn", activePlayerId: "p1" },
    };
    expect(actingOf(game as never)).toEqual({ playerId: "p2", kind: "choice" });
    expect(actingOf({ ...game, pendingChoice: null } as never)).toEqual({ playerId: "p1", kind: "turn" });
    expect(actingOf({ ...game, outcome: { result: "win" } } as never)).toBeNull();
  });
});

describe("heroNameOf", () => {
  it("is the hero without aspect or deck", () => {
    expect(heroNameOf({ label: "Spider-Man (Justice) - Core Set deck" })).toBe("Spider-Man");
    expect(heroNameOf({ label: "She-Hulk" })).toBe("She-Hulk");
  });
});

describe("heldElsewhere (the board's gating)", () => {
  it("holds the board when the hero's seat is another person's", () => {
    expect(heldElsewhere(room(), "p2", false)).toBe(true);
    expect(heldElsewhere(room(), "p1", true)).toBe(false);
  });

  it("lets the host act for a taken-over seat and holds it for a seat someone holds", () => {
    const hostRoom = room({ role: "host", seats: [seat({ takenOver: true }), seat({ id: "s2", player: "p2" })] });
    expect(heldElsewhere(hostRoom, "p1", false)).toBe(false);
    expect(heldElsewhere(hostRoom, "p2", false)).toBe(true);
  });

  it("never holds a single-player game", () => {
    expect(heldElsewhere(NO_ROOM, "p1", false)).toBe(false);
    expect(heldElsewhere(room(), null, true)).toBe(false);
  });
});
