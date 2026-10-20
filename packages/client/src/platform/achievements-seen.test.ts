import { describe, expect, test } from "vitest";
import { ACHIEVEMENTS_SEEN_KEY, achievementsSeen, rememberAchievementsSeen } from "./achievements-seen.js";

class MapStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("achievementsSeen", () => {
  test("null before anything was stored: a first run", () => {
    expect(achievementsSeen(new MapStorage())).toBeNull();
  });

  test("reads back what was remembered", () => {
    const storage = new MapStorage();
    rememberAchievementsSeen(["wins-5", "wins-1"], storage);
    expect(storage.map.get(ACHIEVEMENTS_SEEN_KEY)).toBe('["wins-1","wins-5"]');
    expect([...achievementsSeen(storage)!]).toEqual(["wins-1", "wins-5"]);
  });

  test("an empty list is a known (not first) run", () => {
    const storage = new MapStorage();
    rememberAchievementsSeen([], storage);
    expect(achievementsSeen(storage)?.size).toBe(0);
  });

  test("nonsense in the store reads as a first run, and anything not a string is dropped", () => {
    const storage = new MapStorage();
    storage.setItem(ACHIEVEMENTS_SEEN_KEY, "{not json");
    expect(achievementsSeen(storage)).toBeNull();
    storage.setItem(ACHIEVEMENTS_SEEN_KEY, '{"a":1}');
    expect(achievementsSeen(storage)).toBeNull();
    storage.setItem(ACHIEVEMENTS_SEEN_KEY, '["wins-1",3,null]');
    expect([...achievementsSeen(storage)!]).toEqual(["wins-1"]);
  });

  test("a store that throws reads as a first run and swallows writes", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(achievementsSeen(broken)).toBeNull();
    expect(() => rememberAchievementsSeen(["wins-1"], broken)).not.toThrow();
  });
});
