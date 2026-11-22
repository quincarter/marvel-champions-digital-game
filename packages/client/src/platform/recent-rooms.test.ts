import { ROOM_IDLE_MS } from "@mc/sync-worker/room-protocol";
import { describe, expect, it } from "vitest";
import {
  RECENT_ROOMS_MAX,
  forgetRoom,
  recentRoomsFrom,
  recentRooms,
  rememberRoom,
  roomIsOver,
  withRecentRoom,
} from "./recent-rooms.js";

describe("recent rooms", () => {
  it("puts the newest first and keeps one entry per code", () => {
    const list = withRecentRoom([{ code: "AAAAAA", role: "host", at: 1 }], { code: "BBBBBB", role: "guest", at: 2 });
    expect(withRecentRoom(list, { code: "AAAAAA", role: "guest", at: 3 }).map((r) => r.code)).toEqual([
      "AAAAAA",
      "BBBBBB",
    ]);
  });

  it("caps the list", () => {
    let list: ReturnType<typeof withRecentRoom> = [];
    for (let i = 0; i < 10; i++) list = withRecentRoom(list, { code: `C${i}`, role: "host", at: i });
    expect(list).toHaveLength(RECENT_ROOMS_MAX);
  });

  it("drops stale and malformed entries and survives bad JSON", () => {
    const now = ROOM_IDLE_MS * 3;
    const raw = JSON.stringify([
      { code: "OLD", role: "guest", at: 0 },
      { code: "HOSTED", role: "host", at: now - 1000 },
      { code: "OK", role: "guest", at: now - 1000 },
      { code: 5, role: "guest", at: now },
    ]);
    expect(recentRoomsFrom(raw, now).map((r) => r.code)).toEqual(["OK"]);
    expect(recentRoomsFrom("{nope", now)).toEqual([]);
    expect(recentRoomsFrom(null, now)).toEqual([]);
  });

  it("keeps only guest rooms, and forgets a room that is over", () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    try {
      rememberRoom("HOSTRM", "host", 10);
      rememberRoom("GUESTA", "guest", 11);
      rememberRoom("GUESTB", "guest", 12);
      expect(recentRooms(13).map((r) => r.code)).toEqual(["GUESTB", "GUESTA"]);
      forgetRoom("GUESTB", 13);
      expect(recentRooms(13).map((r) => r.code)).toEqual(["GUESTA"]);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
    expect(roomIsOver("not-found")).toBe(true);
    expect(roomIsOver("closed-idle")).toBe(true);
    expect(roomIsOver("closed-host")).toBe(true);
    expect(roomIsOver("full")).toBe(false);
    expect(roomIsOver(null)).toBe(false);
  });
});
