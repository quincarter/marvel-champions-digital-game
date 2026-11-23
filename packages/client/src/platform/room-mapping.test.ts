/**
 * The host's seat to player mapping at Start (issue #881): the room's lobby revision a start was judged at must still be
 * the one the room holds when the game starts, so the mapping is a compare and swap on it, or no write at all.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";

const posted: { kind: string; ifRev?: number; seats?: { id: string; player?: string }[] }[] = [];
let listener: ((state: RoomState) => void) | null = null;
vi.mock("./live-watch.js", () => ({
  postRoomCommand: (message: (typeof posted)[number]) => {
    posted.push(message);
    return true;
  },
  setRoomDecksListener: () => {},
  setChatPopoutListener: () => {},
  setRoomStateListener: (l: (state: RoomState) => void) => {
    listener = l;
  },
}));

const started: unknown[] = [];
vi.mock("../session.js", () => ({
  appSession: () => ({
    store: {
      state: { status: "playing" },
      start: async (config: unknown) => {
        started.push(config);
      },
    },
    settings: { onlineName: "x" },
  }),
}));

const { seatMappingAt, startGame } = await import("./room.js");

const seat = (id: string, player: string | null): RoomSeat => ({
  id,
  label: id,
  holder: "h",
  holderName: "h",
  holderConnected: true,
  mismatch: false,
  mine: false,
  player,
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
  deck: null,
  deckProblem: null,
});
const room = (rev: number, mapped: boolean, over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "host",
  connection: "connected",
  rev,
  seats: [seat("s1", mapped ? "p1" : null), seat("s2", mapped ? "p2" : null)],
  ...over,
});
const push = (next: RoomState) => listener!(next);

beforeEach(() => {
  posted.length = 0;
  started.length = 0;
  push(NO_ROOM);
});

describe("seatMappingAt", () => {
  it("writes the mapping at the judged revision and starts at the exact next one once it is acknowledged", async () => {
    push(room(4, false));
    const result = seatMappingAt(4);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ kind: "room-lobby", ifRev: 4 });
    expect(posted[0]!.seats!.map((s) => s.player)).toEqual(["p1", "p2"]);
    push(room(5, true));
    expect(await result).toBe(5);
  });

  it("writes nothing when the room's seats already show the mapping, and starts at the judged revision", async () => {
    push(room(4, true));
    expect(await seatMappingAt(4)).toBe(4);
    expect(posted).toHaveLength(0);
  });

  it("aborts when the lobby moved before the write, on a refusal, and on a higher revision", async () => {
    push(room(5, false));
    expect(await seatMappingAt(4)).toBeNull();
    expect(posted).toHaveLength(0);

    push(room(4, false));
    const refused = seatMappingAt(4);
    push(room(4, false, { refusal: { seq: 1, reason: "lobby-changed" } as RoomState["refusal"] }));
    expect(await refused).toBeNull();

    push(room(4, false, { refusal: null }));
    const raced = seatMappingAt(4);
    push(room(6, true));
    expect(await raced).toBeNull();
  });
});

describe("startGame's own mapping write", () => {
  const config = { scenarioId: "rhino", players: [] } as never;
  it("writes nothing for a start that carries its revision (the compare and swap already ran), mapped or not", async () => {
    push(room(5, false));
    await startGame({ ...(config as object), roomLobbyRev: 5 } as never);
    expect(posted).toHaveLength(0);
    expect(started[0]).toMatchObject({ roomLobbyRev: 5 });
  });

  it("for a fresh game or rematch writes the mapping only when it is missing", async () => {
    push(room(5, true));
    await startGame(config);
    expect(posted).toHaveLength(0);
    push(room(5, false));
    await startGame(config);
    expect(posted).toHaveLength(1);
  });
});
