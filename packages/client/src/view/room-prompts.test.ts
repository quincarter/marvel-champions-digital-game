import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import { handoverOn, promptViewOf, roomPromptsOf } from "./room-prompts.js";
import { lastChatLines, markChatRead, resetChatRead, unreadChatCount } from "./room-chat-unread.js";
import { seatRows } from "./room-lobby-model.js";

const seat = (over: Partial<RoomSeat> = {}): RoomSeat => ({
  id: "s1",
  label: "Spider-Man",
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
  deck: null,
  deckProblem: null,
  ...over,
});
const settings = {
  playMode: "host" as const,
  undo: "ask" as const,
  cheats: false,
  tableRules: {},
  mods: [],
  multiSeat: false,
  chat: true,
  appVersion: "1",
  contentVersion: "1",
};
const hostRoom = (over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "host",
  connection: "connected",
  settings,
  seats: [seat()],
  ...over,
});
const turn = { playerId: "p1", kind: "turn" as const };

describe("host prompts", () => {
  it("asks what to do when the seat the game waits on is away", () => {
    const room = hostRoom({ seats: [seat({ away: true, holderConnected: false })] });
    const view = promptViewOf(roomPromptsOf(room, turn), room);
    expect(view?.titleKey).toBe("prompt.away");
    expect(view?.actions.map((a) => a.id)).toEqual(["take-over", "give", "message", "wait"]);
  });

  it("offers only Wait when hand-offs and chat are off", () => {
    const off = { ...settings, handover: false, chat: false } as never;
    const room = hostRoom({ settings: off, seats: [seat({ away: true })] });
    expect(handoverOn(room)).toBe(false);
    const view = promptViewOf(roomPromptsOf(room, turn), room);
    expect(view?.titleKey).toBe("prompt.awayWait");
    expect(view?.actions.map((a) => a.id)).toEqual(["wait"]);
  });

  it("has no prompt for a seat that is away but not the one the game waits on, or one waited on", () => {
    const room = hostRoom({ seats: [seat({ away: true })] });
    expect(roomPromptsOf(room, { playerId: "p2", kind: "turn" })).toEqual([]);
    expect(roomPromptsOf(room, turn, new Set(["s1"]))).toEqual([]);
  });

  it("offers Take over for a vacated seat and Give back for a returned one", () => {
    const vacated = hostRoom({ seats: [seat({ holder: null, holderName: null })] });
    expect(promptViewOf(roomPromptsOf(vacated, turn), vacated)?.titleKey).toBe("prompt.vacant");
    const back = hostRoom({ seats: [seat({ takenOver: true })] });
    expect(promptViewOf(roomPromptsOf(back, null), back)?.actions.map((a) => a.id)).toEqual(["give-back"]);
  });

  it("lists a request with Accept and Decline, and counts the rest", () => {
    const room = hostRoom({
      requests: [
        { id: "r1", from: "g1", name: "Ava", what: "adjust", note: "Fix my threat" },
        { id: "r2", from: "g2", name: "Bo", what: "undo", note: "" },
      ],
    });
    const view = promptViewOf(roomPromptsOf(room, null), room);
    expect(view).toMatchObject({ titleKey: "prompt.asksChange", detail: "Fix my threat", more: 1 });
    expect(view?.actions.map((a) => a.id)).toEqual(["decline", "accept"]);
  });
});

describe("a guest's own request", () => {
  it("shows waiting, then the answer, with Dismiss", () => {
    const guest = { ...NO_ROOM, role: "guest" as const, settings };
    const waiting = { ...guest, myRequest: { what: "undo" as const, status: "waiting" as const, seq: 1 } };
    expect(promptViewOf(roomPromptsOf(waiting, null))?.titleKey).toBe("prompt.waitingUndo");
    const no = { ...guest, myRequest: { what: "adjust" as const, status: "declined" as const, seq: 2 } };
    const view = promptViewOf(roomPromptsOf(no, null));
    expect(view?.titleKey).toBe("prompt.declinedChange");
    expect(view?.actions.map((a) => a.id)).toEqual(["dismiss"]);
  });

  it("has no prompt in single player", () => {
    expect(roomPromptsOf(NO_ROOM, turn)).toEqual([]);
  });
});

describe("lobby seat rows for the host", () => {
  it("offers Take over for an away seat, Give back once taken over, and none when hand-offs are off", () => {
    const away = hostRoom({ seats: [seat({ away: true })] });
    expect(seatRows(away, { installed: [] })[0]?.play?.kind).toBe("takeOver");
    const taken = hostRoom({ seats: [seat({ away: true, takenOver: true })] });
    expect(seatRows(taken, { installed: [] })[0]?.play?.kind).toBe("giveBack");
    const off = hostRoom({ settings: { ...settings, handover: false } as never, seats: [seat({ away: true })] });
    expect(seatRows(off, { installed: [] })[0]?.play).toBeNull();
  });

  it("offers Take over for a seat vacated mid-game", () => {
    const vacated = hostRoom({ started: true, seats: [seat({ holder: null, holderName: null })] });
    const row = seatRows(vacated, { installed: [] })[0];
    expect(row?.play?.kind).toBe("takeOver");
  });
});

describe("room chat unread", () => {
  it("counts other people's lines since the last read", () => {
    resetChatRead();
    const chat = [
      { from: "a", text: "hi", at: 1, mine: false },
      { from: "me", text: "yo", at: 2, mine: true },
      { from: "a", text: "there?", at: 3, mine: false },
    ];
    expect(unreadChatCount(chat)).toBe(2);
    markChatRead(chat);
    expect(unreadChatCount(chat)).toBe(0);
    expect(lastChatLines(chat, 2).map((l) => l.at)).toEqual([2, 3]);
    resetChatRead();
  });
});

describe("Each player Undo (GarethMagis, 2026-11-25)", () => {
  const own = { ...settings, undo: "own" as const };
  const ask = {
    id: "r1",
    from: "g1",
    name: "Ava",
    what: "undo" as const,
    note: "",
    base: 12,
    target: 11,
    moves: "0123456789abcdef",
  };

  it("puts no guest Undo to the host, which does it by itself; a change is still asked", () => {
    expect(roomPromptsOf(hostRoom({ settings: own, requests: [ask] }), null)).toEqual([]);
    const change = { id: "r2", from: "g1", name: "Ava", what: "adjust" as const, note: "" };
    expect(roomPromptsOf(hostRoom({ settings: own, requests: [change] }), null).map((p) => p.kind)).toEqual([
      "request",
    ]);
    // An Undo asked without its table (under Ask, before the host switched) is still the host's to answer.
    const { base: _base, target: _target, moves: _moves, ...unbound } = ask;
    expect(roomPromptsOf(hostRoom({ settings: own, requests: [unbound] }), null).map((p) => p.kind)).toEqual([
      "request",
    ]);
  });

  it("tells the guest nothing while it is done, and says why when the move could not be taken back", () => {
    const guest = { ...NO_ROOM, role: "guest" as const, settings: own };
    for (const status of ["waiting", "accepted"] as const) {
      expect(roomPromptsOf({ ...guest, myRequest: { what: "undo", status, seq: 1 } }, null)).toEqual([]);
    }
    const failed = { ...guest, myRequest: { what: "undo" as const, status: "declined" as const, seq: 2 } };
    expect(promptViewOf(roomPromptsOf(failed, null))?.titleKey).toBe("prompt.ownUndoFailed");
  });
});
