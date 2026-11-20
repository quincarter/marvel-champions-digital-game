/**
 * The host answering a seat holder's request (issue #881): an accepted Undo takes back the asker's own last move, from the
 * version it was worked out at, and never past a reveal (which needs the board's own acknowledgement).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";

const posted: unknown[] = [];
let listener: ((state: RoomState) => void) | null = null;
vi.mock("./live-watch.js", () => ({
  postRoomCommand: (message: unknown) => {
    posted.push(message);
    return true;
  },
  setRoomStateListener: (l: (state: RoomState) => void) => {
    listener = l;
  },
}));

const rewindTo = vi.fn(async (_target: number, _options?: unknown) => true);
const storeState: { game: unknown; commandTrail: unknown[]; version: number } = {
  game: null,
  commandTrail: [],
  version: 0,
};
vi.mock("../session.js", () => ({
  appSession: () => ({ store: { state: storeState, rewindTo }, settings: { undoPastTurn: "allow", onlineName: "x" } }),
}));

const seat = (id: string, player: string, holder: string): RoomSeat => ({
  id,
  label: id,
  holder,
  holderName: holder,
  holderConnected: true,
  mismatch: false,
  mine: false,
  player,
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
});
const hostState = (what: "undo" | "adjust", from: string): RoomState => ({
  ...NO_ROOM,
  role: "host",
  connection: "connected",
  seats: [seat("s1", "p1", "ava"), seat("s2", "p2", "ben")],
  requests: [{ id: "r1", from, name: from, what, note: "" }],
});
const turnOf = (active: string) => ({
  outcome: null,
  pendingChoice: null,
  step: { phase: "player", kind: "turn", activePlayerId: active, ended: false },
});
const move = (playerId: string, draws = 0) => ({
  playerId,
  command: { type: "basicRecover", playerId },
  events: [],
  rngDraws: { before: 0, after: draws },
});

describe("answering a request as the host", () => {
  beforeEach(() => {
    posted.length = 0;
    rewindTo.mockClear();
  });

  async function answer(state: RoomState, accepted = true) {
    const room = await import("./room.js");
    listener?.(state);
    await room.answerRequest("r1", accepted);
  }

  it("takes back the asker's own last move, from the version the target was worked out at, without marking the game adjusted", async () => {
    Object.assign(storeState, { game: turnOf("p2"), commandTrail: [move("p2")], version: 1 });
    await answer(hostState("undo", "ben"));
    expect(rewindTo).toHaveBeenCalledWith(0, { fromVersion: 1 });
    expect(posted.at(-1)).toEqual({ kind: "room-answer", id: "r1", accepted: true });
  });

  it("declines when the asker's hero is not the one whose turn it is, rather than undoing someone else's move", async () => {
    Object.assign(storeState, { game: turnOf("p2"), commandTrail: [move("p2")], version: 1 });
    await answer(hostState("undo", "ava"));
    expect(rewindTo).not.toHaveBeenCalled();
    expect(posted.at(-1)).toEqual({ kind: "room-answer", id: "r1", accepted: false });
  });

  it("declines a move that drew or revealed: past a reveal is for the host's own board to confirm", async () => {
    Object.assign(storeState, { game: turnOf("p2"), commandTrail: [move("p2", 2)], version: 1 });
    await answer(hostState("undo", "ben"));
    expect(rewindTo).not.toHaveBeenCalled();
    expect(posted.at(-1)).toEqual({ kind: "room-answer", id: "r1", accepted: false });
  });

  it("answers no when the table moved and the rewind was refused", async () => {
    Object.assign(storeState, { game: turnOf("p2"), commandTrail: [move("p2")], version: 1 });
    rewindTo.mockResolvedValueOnce(false);
    await answer(hostState("undo", "ben"));
    expect(posted.at(-1)).toEqual({ kind: "room-answer", id: "r1", accepted: false });
  });

  it("answers an accepted adjust yes and opens nothing, and a decline no without touching the game", async () => {
    await answer(hostState("adjust", "ava"));
    expect(posted.at(-1)).toEqual({ kind: "room-answer", id: "r1", accepted: true });
    await answer(hostState("undo", "ben"), false);
    expect(posted.at(-1)).toEqual({ kind: "room-answer", id: "r1", accepted: false });
    expect(rewindTo).not.toHaveBeenCalled();
  });
});
