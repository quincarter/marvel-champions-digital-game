import { describe, expect, test } from "vitest";
import {
  SEATED_GAMES_KEY,
  WATCH_HISTORY_CAP,
  WATCH_HISTORY_KEY,
  readWatchHistory,
  recordWatchedGame,
  SAME_GAME_WINDOW_MS,
  markSeatedGame,
  observeSeatedGame,
  wasSeatedInGame,
  watchedCount,
} from "./watch-history.js";

function memory(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const game = (roomId: string, tableId: string, gid: string | null, endedAt: number, outcome: "win" | "loss" = "win") =>
  ({ roomId, tableId, gid, endedAt, outcome }) as const;

describe("watch history (#909)", () => {
  test("records a watched game and counts it", () => {
    const storage = memory();
    recordWatchedGame(game("A", "main", "g1", 5), storage);
    expect(readWatchHistory(storage)).toEqual([game("A", "main", "g1", 5)]);
    expect(watchedCount(storage)).toBe(1);
  });

  test("the same gid ending again, even long after the window, replaces its entry", () => {
    const storage = memory();
    const later = 5 + SAME_GAME_WINDOW_MS * 10;
    recordWatchedGame(game("A", "main", "g1", 5, "loss"), storage);
    recordWatchedGame(game("A", "main", "g1", later, "win"), storage);
    expect(readWatchHistory(storage)).toEqual([game("A", "main", "g1", later, "win")]);
  });

  test("a fast rematch (new gid) is its own game", () => {
    const storage = memory();
    recordWatchedGame(game("A", "main", "g1", 5), storage);
    recordWatchedGame(game("A", "main", "g2", 9), storage);
    expect(watchedCount(storage)).toBe(2);
  });

  test("two tables ending together in one room count twice", () => {
    const storage = memory();
    recordWatchedGame(game("A", "t1", "g1", 5), storage);
    recordWatchedGame(game("A", "t2", "g2", 6), storage);
    expect(watchedCount(storage)).toBe(2);
  });

  test("without a gid, ends within the window are one game and a later one is a rematch", () => {
    const storage = memory();
    recordWatchedGame(game("A", "main", null, 5, "loss"), storage);
    recordWatchedGame(game("A", "main", null, 9, "win"), storage);
    expect(readWatchHistory(storage)).toEqual([game("A", "main", null, 9, "win")]);
    recordWatchedGame(game("A", "main", null, 9 + SAME_GAME_WINDOW_MS + 1), storage);
    expect(watchedCount(storage)).toBe(2);
  });

  test("an old entry without table or gid reads as the main table, gid unknown", () => {
    const storage = memory();
    storage.data.set(WATCH_HISTORY_KEY, JSON.stringify([{ roomId: "A", endedAt: 1, outcome: "win" }]));
    expect(readWatchHistory(storage)).toEqual([game("A", "main", null, 1)]);
  });

  test("a seat in game A does not exclude a rematch B or another table", () => {
    const storage = memory();
    markSeatedGame("S", "t1", "gA", storage);
    expect(wasSeatedInGame("S", "t1", "gA", storage)).toBe(true);
    expect(wasSeatedInGame("S", "t1", "gB", storage)).toBe(false);
    expect(wasSeatedInGame("S", "t2", "gA", storage)).toBe(false);
    expect(wasSeatedInGame("other", "t1", "gA", storage)).toBe(false);
  });

  test("the seat mark survives a reload (it is in storage, not in memory)", () => {
    const storage = memory();
    markSeatedGame("S", null, "gA", storage);
    // A fresh reader over the same store, as after a reload.
    expect(wasSeatedInGame("S", "main", "gA", { getItem: storage.getItem, setItem: storage.setItem })).toBe(true);
  });

  test("an unknown gid is not a wildcard: an unmarked table is not seated, and an old provisional mark is dropped", () => {
    const storage = memory();
    storage.data.set(SEATED_GAMES_KEY, JSON.stringify([{ roomId: "S", tableId: "main", gid: null }]));
    expect(wasSeatedInGame("S", "main", "gB", storage)).toBe(false);
    markSeatedGame("S", null, "gA", storage);
    expect(wasSeatedInGame("S", "main", null, storage)).toBe(false);
    expect(wasSeatedInGame("S", "main", "gA", storage)).toBe(true);
    expect(wasSeatedInGame("S", "main", "gB", storage)).toBe(false);
  });

  const room = { roomId: "S", tableId: null, gid: null, started: false, seated: true } as const;

  test("a seat claimed then released in the lobby, then watching games A and B, is a spectator both times", () => {
    const storage = memory();
    // Claims a lobby seat (no game, no gid yet), releases it, then the game starts without this device.
    observeSeatedGame(room, storage);
    observeSeatedGame({ ...room, seated: false }, storage);
    observeSeatedGame({ ...room, seated: false, started: true, gid: "gA" }, storage);
    observeSeatedGame({ ...room, seated: false, started: true, gid: "gB" }, storage);
    expect(wasSeatedInGame("S", "main", "gA", storage)).toBe(false);
    expect(wasSeatedInGame("S", "main", "gB", storage)).toBe(false);
    expect(storage.data.get(SEATED_GAMES_KEY)).toBeUndefined();
  });

  test("a game that starts with this device seated is marked once the gid is known, and only that game", () => {
    const storage = memory();
    observeSeatedGame({ ...room, started: true }, storage);
    expect(wasSeatedInGame("S", "main", "gA", storage)).toBe(false);
    observeSeatedGame({ ...room, started: true, gid: "gA" }, storage);
    expect(wasSeatedInGame("S", "main", "gA", storage)).toBe(true);
    expect(wasSeatedInGame("S", "main", "gB", storage)).toBe(false);
  });

  test("keeps the newest 200", () => {
    const storage = memory();
    for (let i = 0; i < WATCH_HISTORY_CAP + 5; i++) {
      recordWatchedGame(game(`r${i}`, "main", `g${i}`, i), storage);
    }
    const list = readWatchHistory(storage);
    expect(list).toHaveLength(WATCH_HISTORY_CAP);
    expect(list[0]!.roomId).toBe("r5");
    expect(list.at(-1)!.roomId).toBe(`r${WATCH_HISTORY_CAP + 4}`);
  });

  test("a damaged store reads as empty, and bad entries are skipped", () => {
    const storage = memory();
    storage.data.set(WATCH_HISTORY_KEY, "{nope");
    expect(readWatchHistory(storage)).toEqual([]);
    storage.data.set(WATCH_HISTORY_KEY, JSON.stringify([{ roomId: 1 }, { roomId: "B", endedAt: 1, outcome: "win" }]));
    expect(watchedCount(storage)).toBe(1);
  });
});
