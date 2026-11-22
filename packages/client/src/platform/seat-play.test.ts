import { describe, expect, test, vi } from "vitest";
import type { RoomSeat, RoomState } from "../live/room-state.js";
import { NO_ROOM } from "../live/room-state.js";
import type { SeatBackend } from "../live/seat-protocol.js";

// `seat-play` reads the app session and the room worker's module at import: neither is wanted here.
vi.mock("../session.js", () => ({
  appSession: () => ({}),
  swapSessionHost: () => ({ store: { dispose: () => undefined } }),
}));
const { refreshUnlocks, notifySaveDataChanged } = vi.hoisted(() => ({
  refreshUnlocks: vi.fn(async () => true),
  notifySaveDataChanged: vi.fn(),
}));
vi.mock("../progression/progression.js", () => ({ refreshUnlocks }));
vi.mock("../sync/save-data-changed.js", () => ({ notifySaveDataChanged }));
vi.mock("../store/session-store.js", () => ({
  SessionStore: class {
    state = { status: "ready" };
    async open() {}
    dispose() {}
  },
}));
vi.mock("./live-watch.js", () => ({ postRoomCommand: () => true, setSeatLeaver: () => undefined }));
vi.mock("../view/seat-context.js", () => ({ setSeatGameUp: () => undefined }));
vi.mock("./room.js", () => ({ roomState: () => NO_ROOM, onRoomState: () => () => undefined, watchRoomGame: vi.fn() }));
const { playRoomGame, enterSeatGame, leaveSeatGame } = await import("./seat-play.js");

const seat = (id: string, extra: Partial<RoomSeat>): RoomSeat =>
  ({ id, mine: false, mismatch: false, takenOver: false, player: null, ...extra }) as RoomSeat;
const guest = (seats: RoomSeat[]): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  roomId: "R".repeat(12),
  started: true,
  seats,
});

function backend(): SeatBackend & { readonly players: string[][] } {
  const players: string[][] = [];
  return {
    players,
    open: async () => ({
      cardPool: {},
      snapshot: {
        version: 0,
        state: { players: [] },
        events: [],
        legal: null,
        record: {},
        saveError: null,
        config: null,
        change: { type: "open", commands: [] },
      } as never,
    }),
    propose: () => undefined,
    setPlayers: async (held) => {
      players.push([...held]);
      return {
        version: 0,
        state: { players: [] },
        events: [],
        legal: null,
        record: {},
        saveError: null,
        config: null,
        change: { type: "players" },
      } as never;
    },
    legalActions: async () => ({ kind: "gameOver" }),
    judgePayment: async () => {
      throw new Error("unused");
    },
    finish: async () => false,
    onEvent: () => undefined,
    dispose: () => undefined,
  };
}

function deps(state: RoomState, watch = vi.fn()) {
  const posted: { kind: string }[] = [];
  const made = backend();
  return {
    posted,
    made,
    watch,
    deps: {
      roomState: () => state,
      post: (message: { kind: string }) => {
        posted.push(message);
        return true;
      },
      makeBackend: () => made,
      packs: () => [],
      packsPending: () => false,
      packsLoaded: async () => undefined,
      watch,
    },
  };
}

describe("playRoomGame", () => {
  test("a guest with a seat that may act gets a seat host, told which heroes it holds, following over a room feed", async () => {
    const {
      deps: d,
      made,
      posted,
    } = deps(guest([seat("s1", { mine: true, player: "p2" }), seat("s2", { player: "p1" })]));
    const result = await playRoomGame(d as never);
    expect(result.ok && result.kind).toBe("seat");
    expect(posted.map((m) => m.kind)).toEqual(["room-follow"]);
    expect(made.players).toEqual([["p2"]]);
    if (result.ok) {
      result.host.dispose();
      expect(posted.map((m) => m.kind)).toEqual(["room-follow", "room-unfollow"]);
    }
  });

  test("a guest with no seat, or only a mismatched or taken-over one, gets the watch view", async () => {
    for (const seats of [
      [seat("s1", { player: "p1" })],
      [seat("s1", { mine: true, player: "p1", mismatch: true })],
      [seat("s1", { mine: true, player: "p1", takenOver: true })],
    ]) {
      const watch = vi.fn(async () => ({ ok: true as const, host: {} as never }));
      const { deps: d, posted } = deps(guest(seats), watch);
      const result = await playRoomGame(d as never);
      expect(result).toEqual({ ok: true, kind: "watch", host: {} });
      expect(watch).toHaveBeenCalledOnce();
      expect(posted).toEqual([]);
    }
  });

  test("a watch that fails is passed on, and not being a guest in a room is a failure", async () => {
    const watch = vi.fn(async () => ({ ok: false as const, message: "watch.link.gone" as const }));
    const { deps: d } = deps(guest([]), watch);
    expect(await playRoomGame(d as never)).toEqual({ ok: false, message: "watch.link.gone" });
    const { deps: none } = deps(NO_ROOM);
    expect((await playRoomGame(none as never)).ok).toBe(false);
  });

  test("a seat whose game cannot be opened gives the feed back to the room worker", async () => {
    const { deps: d, made, posted } = deps(guest([seat("s1", { mine: true, player: "p1" })]));
    made.open = async () => {
      throw new Error("boom");
    };
    const result = await playRoomGame(d as never);
    expect(result.ok).toBe(false);
    expect(posted.map((m) => m.kind)).toEqual(["room-follow", "room-unfollow"]);
  });

  test("a guest's finished row that is written prompts the sync now and the unlock check once the own store is back", async () => {
    let finish: (record: unknown) => void = () => undefined;
    const fakeHost = {
      finishRoomPlay: vi.fn(async () => true),
      setPlayers: async () => ({}),
      dispose: () => undefined,
    };
    await enterSeatGame(
      fakeHost as never,
      () => () => undefined,
      (listener) => {
        finish = listener as never;
        return () => undefined;
      },
    );
    finish({ role: "guest" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fakeHost.finishRoomPlay).toHaveBeenCalledOnce();
    expect(notifySaveDataChanged).toHaveBeenCalledWith("game");
    expect(refreshUnlocks).not.toHaveBeenCalled();
    leaveSeatGame();
    expect(refreshUnlocks).toHaveBeenCalledOnce();
  });
});
