import { describe, expect, test } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "./room-state.js";
import { mergeRoomPlay, trackChatSent, trackRoomState, type RoomPlayTracker } from "./room-play-tracker.js";

const seat = (id: string, player: string | null, over: Partial<RoomSeat> = {}): RoomSeat => ({
  id,
  label: "",
  deck: null,
  deckProblem: null,
  holder: null,
  holderName: null,
  holderConnected: true,
  mismatch: false,
  mine: false,
  player,
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
  ...over,
});

const mineSeat = (id: string, player: string) => seat(id, player, { holder: "me", holderName: "Me", mine: true });
const friendSeat = (id: string, player: string, name: string, over: Partial<RoomSeat> = {}) =>
  seat(id, player, { holder: `id-${name}`, holderName: name, ...over });

const room = (over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  roomId: "room-1",
  me: { id: "me", name: "Me" },
  rev: 7,
  started: true,
  settings: { playMode: "host", cheats: false } as unknown as RoomState["settings"],
  seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava")],
  ...over,
});

/** Feeds states in order and returns the last step. */
function run(states: readonly RoomState[], chats: readonly number[] = []) {
  let tracker: RoomPlayTracker | null = null;
  let finished = null as ReturnType<typeof trackRoomState>["finished"];
  states.forEach((state, i) => {
    for (let n = 0; n < (chats[i] ?? 0); n++) tracker = trackChatSent(tracker);
    const step = trackRoomState(tracker, state);
    tracker = step.tracker;
    finished = step.finished;
  });
  return { tracker, finished };
}

describe("room play tracker", () => {
  test("a finished game gives the guest's record", () => {
    const { finished, tracker } = run([room(), room({ gameOver: true })]);
    expect(tracker).toBeNull();
    expect(finished).toEqual({
      role: "guest",
      roomId: "room-1",
      gameKey: "room-1:7",
      mode: "standard",
      mySeats: ["p1"],
      friends: ["Ava"],
      tookOver: [],
      chatSent: 0,
      strict: false,
      cheats: false,
    });
  });

  test("nothing is tracked before the game starts, or for a game already over", () => {
    expect(run([room({ started: false })]).tracker).toBeNull();
    expect(run([room({ gameOver: true })]).tracker).toBeNull();
  });

  test("a watcher with no seat makes no record, a host with no seat does", () => {
    const watcher = room({ seats: [friendSeat("s1", "p1", "Ava")] });
    expect(run([watcher, { ...watcher, gameOver: true }]).finished).toBeNull();
    const host = { ...watcher, role: "host" as const };
    expect(run([host, { ...host, gameOver: true }]).finished?.mySeats).toEqual([]);
  });

  test("chat counts only while the game is running", () => {
    const before = run([room({ started: false })], [3]);
    expect(before.tracker).toBeNull();
    const { finished } = run([room(), room(), room({ gameOver: true })], [0, 2, 1]);
    expect(finished?.chatSent).toBe(3);
  });

  test("friends are the other holders seen during the game, even one who left before the end", () => {
    const start = room({ seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava"), friendSeat("s3", "p3", "Bo")] });
    const later = room({ seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava"), seat("s3", "p3")] });
    const { finished } = run([start, later, { ...later, gameOver: true }]);
    expect(finished?.friends).toEqual(["Ava", "Bo"]);
  });

  test("taking over a seat whose holder was away is an away takeover", () => {
    const start = room({ seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava", { away: true })] });
    const after = room({
      role: "host",
      seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava", { away: true, takenOver: true })],
    });
    const { finished } = run([{ ...start, role: "host" }, after, { ...after, gameOver: true }]);
    expect(finished?.tookOver).toEqual([{ player: "p2", reason: "away" }]);
    expect(finished?.mySeats).toEqual(["p1", "p2"]);
    expect(finished?.role).toBe("host");
  });

  test("taking up a vacant seat is a left takeover, and the seat is mine at the end", () => {
    const vacant = room({ seats: [mineSeat("s1", "p1"), seat("s2", "p2")] });
    const taken = room({ seats: [mineSeat("s1", "p1"), mineSeat("s2", "p2")] });
    const { finished } = run([vacant, taken, { ...taken, gameOver: true }]);
    expect(finished?.tookOver).toEqual([{ player: "p2", reason: "left" }]);
    expect(finished?.mySeats).toEqual(["p1", "p2"]);
  });

  test("a seat I held from the start is not a takeover; one I gave up is not mine at the end", () => {
    const start = room();
    const gaveUp = room({ seats: [seat("s1", "p1"), friendSeat("s2", "p2", "Ava"), mineSeat("s3", "p3")] });
    const { finished } = run([start, gaveUp, { ...gaveUp, gameOver: true }]);
    expect(finished?.tookOver).toEqual([]);
    expect(finished?.mySeats).toEqual(["p3"]);
  });

  test("strict and cheats stick once seen", () => {
    const strict = room({ settings: { playMode: "strict", cheats: false } as unknown as RoomState["settings"] });
    const cheated = room({ settings: { playMode: "host", cheats: true } as unknown as RoomState["settings"] });
    const { finished } = run([strict, cheated, { ...room(), gameOver: true }]);
    expect(finished?.strict).toBe(true);
    expect(finished?.cheats).toBe(true);
  });

  test("Epic records my table's group and pod size, and only my table's friends", () => {
    const epic = {
      myTable: "t1",
      tables: [
        { id: "t1", pod: "pod", seats: ["s1", "s2"] },
        { id: "t2", pod: "pod", seats: ["s3"] },
      ],
      pods: [{ id: "pod", name: "Pod", tables: ["t1", "t2"] }],
    } as unknown as RoomState["epic"];
    const start = room({
      mode: "epic",
      epic,
      seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava"), friendSeat("s3", "p1", "Far")],
    });
    const { finished } = run([start, { ...start, gameOver: true }]);
    expect(finished?.mode).toBe("epic");
    expect(finished?.epic).toEqual({ groupId: "t1", tables: 2 });
    expect(finished?.friends).toEqual(["Ava"]);
    expect(finished?.mySeats).toEqual(["p1"]);
  });

  test("Competitive records my team", () => {
    const start = room({
      mode: "competitive",
      competitive: { myTeam: "resistance" } as unknown as RoomState["competitive"],
    });
    const { finished } = run([start, { ...start, gameOver: true }]);
    expect(finished?.mode).toBe("competitive");
    expect(finished?.competitive).toEqual({ team: "resistance", side: "resistance" });
  });

  test("leaving the room or returning to the lobby drops the game without a record", () => {
    expect(run([room(), NO_ROOM])).toEqual({ tracker: null, finished: null });
    expect(run([room(), room({ started: false })])).toEqual({ tracker: null, finished: null });
  });
});

describe("a device that runs the game", () => {
  const epicTable = (hostsTable: string | null) =>
    ({
      organizer: false,
      hostsTable,
      myTable: "t1",
      tables: [{ id: "t1", pod: "pod", seats: ["s1", "s2"] }],
      pods: [{ id: "pod", name: "Pod", tables: ["t1"] }],
    }) as unknown as RoomState["epic"];

  test("a non-organizer Epic table host is recorded as the host, with its takeovers", () => {
    const start = room({
      mode: "epic",
      epic: epicTable("t1"),
      seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava", { away: true })],
    });
    const after = room({
      mode: "epic",
      epic: epicTable("t1"),
      seats: [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava", { away: true, takenOver: true })],
    });
    const { finished } = run([start, after, { ...after, gameOver: true }]);
    expect(finished?.role).toBe("host");
    expect(finished?.tookOver).toEqual([{ player: "p2", reason: "away" }]);
    expect(finished?.mySeats).toEqual(["p1", "p2"]);
  });

  test("an Epic guest who does not host a table stays a guest", () => {
    const start = room({ mode: "epic", epic: epicTable(null) });
    expect(run([start, { ...start, gameOver: true }]).finished?.role).toBe("guest");
  });

  test("the host's record is offered as soon as the game starts, and again as it changes", () => {
    const host = room({ role: "host" });
    const first = trackRoomState(null, host);
    expect(first.progress?.role).toBe("host");
    expect(first.progress?.mySeats).toEqual(["p1"]);
    const next = trackRoomState(
      first.tracker,
      room({ role: "host", seats: [mineSeat("s1", "p1"), mineSeat("s2", "p2")] }),
    );
    expect(next.progress?.mySeats).toEqual(["p1", "p2"]);
    expect(trackRoomState(null, room()).progress).toBeNull();
  });
});

describe("game identity (the table's admission id)", () => {
  const withGid = (over: Partial<RoomState> = {}) => room({ tableId: "main", gid: "g-1", ...over });

  test("the key is room, table and gid, with the revision only as a stand-in until the gid is known", () => {
    expect(run([withGid(), withGid({ gameOver: true })]).finished?.gameKey).toBe("room-1:main:g-1");
    expect(run([room(), room({ gameOver: true })]).finished?.gameKey).toBe("room-1:7");
  });

  test("a gid that arrives mid-game replaces the stand-in key", () => {
    const { finished } = run([room(), withGid({ rev: 9 }), withGid({ rev: 9, gameOver: true })]);
    expect(finished?.gameKey).toBe("room-1:main:g-1");
  });

  test("a late join or reload after a lobby change keys the same game as the host", () => {
    const hostSide = run([withGid({ rev: 7 }), withGid({ rev: 7, gameOver: true })]).finished;
    const lateGuest = run([withGid({ rev: 12 }), withGid({ rev: 12, gameOver: true })]).finished;
    expect(lateGuest?.gameKey).toBe(hostSide?.gameKey);
  });

  test("a rematch (a new gid) is another game", () => {
    const first = run([withGid(), withGid({ gameOver: true })]).finished;
    const rematch = run([withGid({ gid: "g-2" }), withGid({ gid: "g-2", gameOver: true })]).finished;
    expect(rematch?.gameKey).not.toBe(first?.gameKey);
  });

  test("a different admitted game in the same room, with no end between, starts fresh", () => {
    const old = withGid({
      role: "host",
      seats: [mineSeat("s1", "p1")],
      settings: { playMode: "strict", cheats: true } as never,
    });
    const fresh = withGid({ role: "host", gid: "g-2", seats: [mineSeat("s1", "p1")] });
    let tracker = trackRoomState(null, old).tracker;
    tracker = trackChatSent(tracker);
    const step = trackRoomState(tracker, fresh);
    expect(step.finished).toBeNull();
    expect(step.progress).toMatchObject({
      gameKey: "room-1:main:g-2",
      chatSent: 0,
      strict: false,
      cheats: false,
      friends: [],
    });
    const end = trackRoomState(step.tracker, { ...fresh, gameOver: true });
    expect(end.finished).toMatchObject({ gameKey: "room-1:main:g-2", chatSent: 0, strict: false, cheats: false });
  });

  test("following another table of the room is another game", () => {
    const first = trackRoomState(null, withGid({ tableId: "t1", gid: "ga" })).tracker;
    const step = trackRoomState(trackChatSent(first), withGid({ tableId: "t2", gid: "ga" }));
    expect(step.tracker?.chatSent).toBe(0);
    expect(step.tracker?.table).toBe("t2");
  });

  test("two Epic tables at the same room revision with the same seat ids do not collapse", () => {
    const at = (table: string, gid: string) => withGid({ tableId: table, gid });
    const one = run([at("t1", "ga"), { ...at("t1", "ga"), gameOver: true }]).finished;
    const two = run([at("t2", "gb"), { ...at("t2", "gb"), gameOver: true }]).finished;
    expect(one?.gameKey).not.toBe(two?.gameKey);
  });
});

describe("takeover history across a reload", () => {
  const host = (over: Partial<RoomState> = {}) => room({ role: "host", tableId: "main", gid: "g-1", ...over });
  const away = [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava", { away: true })];
  const taken = [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava", { away: true, takenOver: true })];
  const back = [mineSeat("s1", "p1"), friendSeat("s2", "p2", "Ava")];

  test("takeover, handoff, reload, finish keeps the seat and the takeover credit", () => {
    // Before the reload: I took p2 over (its holder was away), then the holder took it back.
    const before = run([host({ seats: away }), host({ seats: taken }), host({ seats: back })]);
    const saved = recordOfTracker(before.tracker!);
    expect(saved.tookOver).toEqual([{ player: "p2", reason: "away" }]);
    // After the reload the tracker starts empty and sees only the handed-back state.
    const after = run([host({ seats: back }), host({ seats: back, gameOver: true })]).finished!;
    expect(after.tookOver).toEqual([]);
    expect(after.mySeats).toEqual(["p1"]);
    const merged = mergeRoomPlay({ ...saved, chatSent: 2 }, after);
    expect(merged.tookOver).toEqual([{ player: "p2", reason: "away" }]);
    expect(merged.mySeats).toEqual(["p1", "p2"]);
    expect(merged.chatSent).toBe(2);
  });

  test("a record of another game (a rematch) is not carried in", () => {
    const record = run([host(), host({ gameOver: true })]).finished!;
    const old = {
      ...record,
      gameKey: "room-1:main:g-0",
      mySeats: ["p1", "p2"],
      tookOver: [{ player: "p2", reason: "left" }],
    };
    expect(mergeRoomPlay(old as never, record)).toEqual(record);
  });
});

function recordOfTracker(tracker: RoomPlayTracker) {
  const step = trackRoomState(tracker, room({ role: "host", tableId: "main", gid: "g-1", gameOver: true }));
  return step.finished!;
}
