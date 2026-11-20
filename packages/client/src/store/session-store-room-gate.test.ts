/**
 * The store's one choke point for a room game (issue #881): a command for a hero whose seat this device does not act for
 * is refused whatever screen sent it (setup's mulligan, a defend choice, the board), a hero it does act for goes through,
 * Concede is the table's, and a game with no room is untouched.
 */
import { afterEach, describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import { setSeatContextSource, setSeatGameUp } from "../view/seat-context.js";
import { SessionStore } from "./session-store.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
  seed: 2026,
};

const seat = (over: Partial<RoomSeat>): RoomSeat => ({
  id: "s1",
  label: "Hero",
  holder: "x",
  holderName: "Someone",
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

const roomWith = (role: "host" | "guest", mineOf: { p1: boolean; p2: boolean }): RoomState => ({
  ...NO_ROOM,
  role,
  connection: "connected",
  seats: [seat({ id: "s1", player: "p1", mine: mineOf.p1 }), seat({ id: "s2", player: "p2", mine: mineOf.p2 })],
});

afterEach(() => {
  setSeatContextSource(null);
  setSeatGameUp(false);
});

describe("SessionStore.dispatch in a room game", () => {
  test("refuses a command for a hero held elsewhere, and says so", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(CONFIG);
    const acting = store.state.legal!.playerId;
    const other = acting === "p1" ? "p2" : "p1";
    setSeatContextSource(() => roomWith("host", { p1: acting === "p1", p2: acting === "p2" }));
    const before = store.state.version;
    // The pending decision (a mulligan) belongs to `acting`; a command for the other hero is not this device's to send.
    expect(await store.dispatch({ type: "endTurn", playerId: other as never })).toBe(false);
    expect(store.state.version).toBe(before);
    expect(store.state.error).toBeTruthy();
  });

  test("refuses the host answering a guest's mulligan, and lets the guest's own device answer it", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(CONFIG);
    const choice = store.state.game!.pendingChoice!;
    // The host holds nothing for the hero the choice names.
    setSeatContextSource(() => roomWith("host", { p1: choice.playerId !== "p1", p2: choice.playerId !== "p2" }));
    expect(await store.resolveChoice([])).toBe(false);
    expect(store.state.game!.pendingChoice?.choiceId).toBe(choice.choiceId);
    // Once the seat is this device's, the same answer goes through.
    setSeatContextSource(() => roomWith("host", { p1: true, p2: true }));
    expect(await store.resolveChoice([])).toBe(true);
  });

  test("never blocks Concede, which is the table's", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(CONFIG);
    setSeatContextSource(() => roomWith("host", { p1: false, p2: false }));
    expect(await store.dispatch({ type: "concede", playerId: store.state.game!.firstPlayerId })).toBe(true);
  });

  test("does nothing in a game with no room", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(CONFIG);
    setSeatContextSource(() => NO_ROOM);
    expect(await store.resolveChoice([])).toBe(true);
  });
});
