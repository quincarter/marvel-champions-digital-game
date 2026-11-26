import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomChatLine, type RoomParticipant, type RoomState } from "../live/room-state.js";
import {
  ChatSeen,
  ChatSoundGate,
  CHAT_SOUND_GAP_MS,
  newChatFromOthers,
  newRequestsForHost,
  requestsForHostToAnswer,
  selfAnswered,
  selfAnsweredRequests,
  participantChanges,
  roomClosedInGame,
  unreadChatCount,
  windowFocused,
} from "./room-notices.js";

const person = (id: string, name: string, me = false): RoomParticipant => ({
  id,
  name,
  role: "watcher",
  me,
  buildMatches: true,
  seats: [],
});

const line = (text: string, mine = false): RoomChatLine => ({ from: mine ? "me" : "x", text, at: 1, mine });

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...NO_ROOM,
    role: "guest",
    connection: "connected",
    roomId: "R1",
    me: { id: "me", name: "Me" },
    participants: [person("me", "Me", true)],
    ...overrides,
  };
}

describe("roomClosedInGame", () => {
  const connected = { connection: "connected" } as const;
  const closed = { connection: "ended", problem: "closed-host" } as const;
  it("sends a player in a game scene to Play online when the host closed the room", () => {
    expect(roomClosedInGame(connected, closed, ["Board", "ChoiceOverlay"])).toBe("closed-host");
    expect(roomClosedInGame(connected, closed, ["SetupDeal"])).toBe("closed-host");
    expect(roomClosedInGame(connected, { connection: "ended", problem: "closed-idle" }, ["Board"])).toBe("closed-idle");
  });
  it("leaves the lobby, a finished game and other endings to their own screens", () => {
    expect(roomClosedInGame(connected, closed, ["RoomLobby"])).toBeNull();
    expect(roomClosedInGame(connected, closed, ["Online"])).toBeNull();
    expect(roomClosedInGame(connected, closed, ["Board", "GameOver"])).toBeNull();
    expect(roomClosedInGame(connected, { connection: "ended", problem: "closed-ended" }, ["Board"])).toBeNull();
    expect(roomClosedInGame(connected, { connection: "ended", problem: "unavailable" }, ["Board"])).toBeNull();
  });
  it("fires once, at the moment the room ends", () => {
    expect(roomClosedInGame(closed, closed, ["Board"])).toBeNull();
    expect(roomClosedInGame(connected, connected, ["Board"])).toBeNull();
  });
});

describe("participantChanges", () => {
  it("names who joined and who left, never me", () => {
    const before = room({ participants: [person("me", "Me", true), person("a", "Ann")] });
    const after = room({ participants: [person("me", "Me", true), person("b", "Bo")] });
    expect(participantChanges(before, after).map((c) => [c.kind, c.name])).toEqual([
      ["joined", "Bo"],
      ["left", "Ann"],
    ]);
  });

  it("is quiet for my own arrival and for a reconnect (a new id of mine, a fresh roster)", () => {
    const empty = room({ me: null, participants: [] });
    const first = room({ participants: [person("me", "Me", true), person("a", "Ann")] });
    expect(participantChanges(empty, first)).toEqual([]);
    const again = room({
      me: { id: "me2", name: "Me" },
      participants: [person("me2", "Me", true), person("a", "Ann")],
    });
    expect(participantChanges(first, again)).toEqual([]);
    expect(participantChanges(first, room({ connection: "reconnecting", participants: [] }))).toEqual([]);
  });

  it("reports nothing when the roster is the same", () => {
    const state = room({ participants: [person("me", "Me", true), person("a", "Ann")] });
    expect(participantChanges(state, { ...state })).toEqual([]);
  });
});

describe("newChatFromOthers", () => {
  it("returns the live lines that are not mine, and none for the backlog", () => {
    const backlog = room({ chat: [line("old"), line("older")], chatLive: 0 });
    expect(newChatFromOthers(room(), backlog)).toEqual([]);
    const live = room({ chat: [line("old"), line("hi"), line("me too", true)], chatLive: 2 });
    expect(newChatFromOthers(backlog, live).map((l) => l.text)).toEqual(["hi"]);
  });
});

describe("ChatSoundGate", () => {
  it("never sounds while the window has focus", () => {
    const gate = new ChatSoundGate();
    expect(gate.take(0, true)).toBe(false);
    // A refused line does not start the throttle.
    expect(gate.take(1, false)).toBe(true);
  });

  it("sounds at most once every three seconds", () => {
    const gate = new ChatSoundGate();
    expect(gate.take(10_000, false)).toBe(true);
    expect(gate.take(10_000 + CHAT_SOUND_GAP_MS - 1, false)).toBe(false);
    expect(gate.take(10_000 + CHAT_SOUND_GAP_MS, false)).toBe(true);
  });
});

describe("windowFocused", () => {
  it("is false for a hidden tab or a window without focus", () => {
    expect(windowFocused({ visibilityState: "visible", hasFocus: () => true })).toBe(true);
    expect(windowFocused({ visibilityState: "hidden", hasFocus: () => true })).toBe(false);
    expect(windowFocused({ visibilityState: "visible", hasFocus: () => false })).toBe(false);
    expect(windowFocused(undefined)).toBe(true);
  });
});

describe("unread chat", () => {
  it("counts the lines from others since the tab was last viewed", () => {
    const chat = [line("a"), line("b"), line("mine", true), line("c")];
    expect(unreadChatCount({ chat, chatLive: 4 }, 0)).toBe(3);
    expect(unreadChatCount({ chat, chatLive: 4 }, 3)).toBe(1);
    expect(unreadChatCount({ chat, chatLive: 4 }, 4)).toBe(0);
  });

  it("never counts the backlog, my own lines, or more than the lines kept", () => {
    const chat = [line("old"), line("older")];
    expect(unreadChatCount({ chat, chatLive: 0 }, 0)).toBe(0);
    expect(unreadChatCount({ chat: [line("x", true)], chatLive: 1 }, 0)).toBe(0);
    expect(unreadChatCount({ chat: [line("x")], chatLive: 500 }, 0)).toBe(1);
  });

  it("clears when the tab is opened and starts over for a new room", () => {
    const seen = new ChatSeen();
    expect(seen.seenFor("R1")).toBe(0);
    seen.markSeen("R1", 5);
    expect(seen.seenFor("R1")).toBe(5);
    expect(seen.seenFor("R2")).toBe(0);
  });
});

describe("newRequestsForHost", () => {
  const ask = (id: string) => ({ id, from: "g1", name: "Ava", what: "undo" as const, note: "" });

  it("names a guest's new Undo or change request on the host's device", () => {
    const before = room({ role: "host", requests: [ask("r1")] });
    expect(newRequestsForHost(before, room({ role: "host", requests: [ask("r1"), ask("r2")] }))).toEqual([ask("r2")]);
    expect(newRequestsForHost(before, room({ role: "host", requests: [ask("r1")] }))).toEqual([]);
  });

  it("stays quiet on a guest's device and across rooms", () => {
    expect(newRequestsForHost(room(), room({ requests: [ask("r1")] }))).toEqual([]);
    const other = room({ role: "host", roomId: "R2", requests: [ask("r1")] });
    expect(newRequestsForHost(room({ role: "host" }), other)).toEqual([]);
  });
});

describe("the host's own answers to Each player Undo", () => {
  const settings = {
    playMode: "host" as const,
    undo: "own" as const,
    cheats: false,
    tableRules: {},
    mods: [],
    multiSeat: false,
    chat: true,
    appVersion: "1",
    contentVersion: "1",
  };
  // A bound Undo: the table the guest saw (`base`) and the count its Undo goes back to (`target`).
  const undo = { id: "r1", from: "g1", name: "Ava", what: "undo" as const, note: "", base: 12, target: 11 };
  const change = { id: "r2", from: "g1", name: "Ava", what: "adjust" as const, note: "" };

  it("answers a guest's Undo by itself, with no sound, and still sounds for a change", () => {
    const before = room({ role: "host", settings });
    const after = room({ role: "host", settings, requests: [undo, change] });
    expect(selfAnsweredRequests(before, after)).toEqual([undo]);
    expect(requestsForHostToAnswer(before, after)).toEqual([change]);
  });

  it("leaves every request to the host under Ask the host, and never answers on a guest's device", () => {
    const ask = { ...settings, undo: "ask" as const };
    expect(selfAnswered(room({ role: "host", settings: ask }), undo)).toBe(false);
    expect(
      requestsForHostToAnswer(
        room({ role: "host", settings: ask }),
        room({ role: "host", settings: ask, requests: [undo] }),
      ),
    ).toEqual([undo]);
    expect(selfAnswered(room({ settings }), undo)).toBe(false);
  });

  it("leaves an Undo asked without its table (under Ask, before a switch) to the host", () => {
    const { base: _base, target: _target, ...unbound } = undo;
    expect(selfAnswered(room({ role: "host", settings }), unbound)).toBe(false);
  });
});
