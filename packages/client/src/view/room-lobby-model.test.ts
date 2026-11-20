import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import {
  connectionWords,
  guestModRows,
  hostModRows,
  missingMods,
  participantRows,
  refusalWords,
  seatRows,
  startBlock,
  toggleModPatch,
  toggleTableRulePatch,
} from "./room-lobby-model.js";

const settings = {
  playMode: "strict" as const,
  tableRules: {},
  mods: [],
  multiSeat: false,
  chat: true,
  appVersion: "1",
  contentVersion: "1",
};
const seat = (over: Partial<RoomSeat> = {}): RoomSeat => ({
  id: "s1",
  label: "Spider-Man",
  holder: null,
  holderName: null,
  holderConnected: false,
  mismatch: false,
  mine: false,
  requests: [],
  requestedByMe: false,
  ...over,
});
const room = (over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  settings,
  seats: [seat()],
  participants: [
    { id: "h", name: "Host", role: "host", me: false, buildMatches: true, seats: [] },
    { id: "g", name: "Guest", role: "watcher", me: true, buildMatches: true, seats: [] },
  ],
  ...over,
});

describe("connectionWords", () => {
  it("is silent while connected and words the problem when ended", () => {
    expect(connectionWords(room())).toBeNull();
    expect(connectionWords(room({ connection: "reconnecting" }))?.key).toBe("room.state.reconnecting");
    expect(connectionWords(room({ connection: "ended", problem: "not-found" }))?.key).toBe("room.problem.notFound");
  });
});

describe("refusalWords", () => {
  it("names the seat", () => {
    const state = room();
    expect(refusalWords({ reason: "seat-taken", seat: "s1", seq: 1 }, state)).toEqual({
      key: "room.refusal.seatTaken",
      params: { seat: "Spider-Man" },
    });
    expect(refusalWords({ reason: "build-mismatch", seq: 2 }, state)?.key).toBe("room.refusal.buildMismatch");
    expect(refusalWords(null, state)).toBeNull();
  });
});

describe("participantRows", () => {
  it("marks the host by role and a seat holder as a player", () => {
    const rows = participantRows(
      room({
        participants: [
          { id: "h", name: "Host", role: "host", me: false, buildMatches: true, seats: [] },
          { id: "g", name: "G", role: "watcher", me: true, buildMatches: false, seats: ["s1"] },
          { id: "w", name: "W", role: "watcher", me: false, buildMatches: true, seats: [] },
        ],
      }),
    );
    expect(rows.map((r) => r.role)).toEqual(["host", "player", "watcher"]);
    expect(rows[1]).toMatchObject({ seats: ["Spider-Man"], differentVersion: true });
  });
});

describe("seatRows", () => {
  const ctx = { installed: [] };
  it("offers Ask on an open seat, and Leave on mine", () => {
    expect(seatRows(room(), ctx)[0]?.action).toMatchObject({ kind: "ask", enabled: true });
    const mine = seatRows(room({ seats: [seat({ holder: "g", holderName: "Guest", mine: true })] }), ctx)[0];
    expect(mine?.action?.kind).toBe("leave");
  });
  it("turns Ask off with the reason", () => {
    expect(seatRows(room({ buildMatches: false }), ctx)[0]?.action).toMatchObject({
      enabled: false,
      reason: "room.seat.differentVersion",
    });
    expect(seatRows(room({ mySeats: ["s2"] }), ctx)[0]?.action?.reason).toBe("room.seat.oneEach");
    const multi = room({ mySeats: ["s2"], settings: { ...settings, multiSeat: true } });
    expect(seatRows(multi, ctx)[0]?.action?.enabled).toBe(true);
    const mods = room({ settings: { ...settings, mods: [{ id: "x", version: "1" }] } });
    expect(seatRows(mods, ctx)[0]?.action?.reason).toBe("room.seat.needsMods");
  });
  it("shows requests to the host only, with approve off for a different version", () => {
    const requested = [seat({ requests: [{ participant: "g", name: "Guest" }] })];
    expect(seatRows(room({ seats: requested }), ctx)[0]?.requests).toEqual([]);
    const host = room({
      role: "host",
      seats: requested,
      participants: [{ id: "g", name: "Guest", role: "watcher", me: false, buildMatches: false, seats: [] }],
    });
    expect(seatRows(host, ctx)[0]?.requests[0]).toMatchObject({ approvable: false, reason: "room.seat.theirVersion" });
    expect(seatRows(host, ctx)[0]?.action?.kind).toBe("take");
  });
});

describe("seat pictures and giving a seat", () => {
  it("splits the identity card from the label", () => {
    const state = room({ seats: [seat({ label: "Spider-Man|01001a" })] });
    expect(seatRows(state, { installed: [] })[0]).toMatchObject({ label: "Spider-Man", cardId: "01001a" });
  });
  it("lists who the host could give an open seat to", () => {
    const host = room({
      role: "host",
      participants: [
        { id: "h", name: "Host", role: "host", me: true, buildMatches: true, seats: [] },
        { id: "a", name: "A", role: "watcher", me: false, buildMatches: true, seats: [] },
        { id: "b", name: "B", role: "watcher", me: false, buildMatches: true, seats: ["s9"] },
        { id: "c", name: "C", role: "watcher", me: false, buildMatches: false, seats: [] },
      ],
    });
    expect(seatRows(host, { installed: [] })[0]?.candidates.map((p) => p.id)).toEqual(["a"]);
    const multi = { ...host, settings: { ...settings, multiSeat: true } };
    expect(seatRows(multi, { installed: [] })[0]?.candidates.map((p) => p.id)).toEqual(["a", "b"]);
    expect(seatRows(room(), { installed: [] })[0]?.candidates).toEqual([]);
  });
});

describe("devices in words", () => {
  it("says platform and form on each person and seat holder, and nothing for an older client", () => {
    const state = room({
      participants: [
        {
          id: "a",
          name: "A",
          role: "watcher",
          me: false,
          buildMatches: true,
          seats: ["s1"],
          device: { platform: "android", form: "phone" },
        },
        { id: "b", name: "B", role: "watcher", me: false, buildMatches: true, seats: [] },
      ],
      seats: [seat({ holder: "a", holderName: "A", holderConnected: true })],
    });
    expect(participantRows(state).map((p) => p.device)).toEqual(["Android · phone", null]);
    expect(participantRows(state)[0]?.platform).toBe("android");
    expect(seatRows(state, { installed: [] })[0]?.holderDevice).toBe("Android · phone");
  });
});

describe("startBlock", () => {
  const ready = { tableReady: true, packsUsed: [] };
  const held = seat({ holder: "g", holderName: "Guest", holderConnected: true });
  it("needs a table, held seats, matching builds and allowed mods", () => {
    const host = room({ role: "host", seats: [held] });
    expect(startBlock(host, ready)).toBeNull();
    expect(startBlock(host, { ...ready, tableReady: false })?.key).toBe("room.start.noTable");
    expect(startBlock(room({ role: "host", seats: [seat()] }), ready)).toEqual({
      key: "room.start.openSeats",
      params: { count: 1 },
    });
    expect(startBlock(room({ role: "host", seats: [{ ...held, mismatch: true }] }), ready)?.key).toBe(
      "room.start.versionMismatch",
    );
    expect(startBlock(room({ role: "host", seats: [{ ...held, holderConnected: false }] }), ready)?.key).toBe(
      "room.start.holderAway",
    );
    expect(startBlock(host, { ...ready, packsUsed: [{ id: "p", version: "1" }] })?.key).toBe(
      "room.start.modNotAllowed",
    );
    expect(startBlock(room({ seats: [held] }), ready)?.key).toBe("room.start.hostOnly");
  });
});

describe("host controls", () => {
  it("toggles a table rule and a mod", () => {
    expect(toggleTableRulePatch(settings, "sameNameHeroAllyConflict")).toEqual({
      tableRules: { sameNameHeroAllyConflict: true },
    });
    const on = { ...settings, tableRules: { sameNameHeroAllyConflict: true } };
    expect(toggleTableRulePatch(on, "sameNameHeroAllyConflict")).toEqual({ tableRules: {} });
    expect(toggleModPatch(settings, { id: "m", version: "2" })).toEqual({ mods: [{ id: "m", version: "2" }] });
    expect(toggleModPatch({ ...settings, mods: [{ id: "m", version: "2" }] }, { id: "m", version: "2" })).toEqual({
      mods: [],
    });
  });
  it("allows a pack only at the version the host allowed", () => {
    const held = seat({ holder: "g", holderName: "Guest", holderConnected: true });
    const ready = { tableReady: true, packsUsed: [] };
    const withMod = room({ role: "host", seats: [held], settings: { ...settings, mods: [{ id: "p", version: "1" }] } });
    expect(startBlock(withMod, { ...ready, packsUsed: [{ id: "p", version: "1" }] })).toBeNull();
    expect(startBlock(withMod, { ...ready, packsUsed: [{ id: "p", version: "2" }] })?.key).toBe(
      "room.start.modNotAllowed",
    );
    expect(hostModRows(withMod.settings, [{ id: "p", version: "2", name: "P" }])[0]?.allowed).toBe(false);
    expect(toggleModPatch(withMod.settings!, { id: "p", version: "2" })).toEqual({ mods: [{ id: "p", version: "2" }] });
  });
  it("finds the mods a guest lacks, at the same version", () => {
    const allowed = [{ id: "m", version: "2" }];
    expect(missingMods(allowed, [{ id: "m", version: "1" }])).toEqual(allowed);
    expect(missingMods(allowed, [{ id: "m", version: "2" }])).toEqual([]);
    expect(guestModRows({ ...settings, mods: allowed }, [])[0]?.have).toBe(false);
  });
});
