import { describe, expect, test } from "vitest";
import type { Track } from "../audio/music-catalog.js";
import type { ExtrasEntry, ExtrasUnlock } from "../progression/extras.js";
import {
  clockOf,
  earnedSongsOf,
  lockedSongCount,
  musicSlotBeside,
  nextShuffled,
  nowPlayingBanner,
  nowPlayingPill,
  playerPanelRect,
  shuffledQueue,
} from "./music-player.js";

const track = (name: string): Track => ({ key: `music:${name}.mp3`, url: `/${name}.mp3` });
const song = (name: string, unlock: ExtrasUnlock): ExtrasEntry => ({
  id: `music:${name}`,
  tab: "music",
  title: name,
  subtitle: `Battle · ${name}`,
  thumb: null,
  unlock,
  content: { kind: "track", track: track(name) },
});

const entries = [
  song("Main Title", { kind: "always" }),
  song("Rhino", { kind: "scenarioPlayed", scenarioId: "rhino" }),
  song("Klaw", { kind: "scenarioPlayed", scenarioId: "klaw" }),
];
const playedRhino = {
  isOpen: (unlock: ExtrasUnlock) =>
    unlock.kind === "always" || ("scenarioId" in unlock && unlock.scenarioId === "rhino"),
};

/** A fixed sequence of `random()` results, repeating. */
const randoms = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[index++ % values.length]!;
};

describe("earned songs", () => {
  test("only the songs Extras has opened, in its order", () => {
    expect(earnedSongsOf(playedRhino, entries).map((s) => s.title)).toEqual(["Main Title", "Rhino"]);
    expect(lockedSongCount(playedRhino, entries)).toBe(1);
  });

  test("a song carries its track and where it plays", () => {
    const [first] = earnedSongsOf(playedRhino, entries);
    expect(first).toEqual({
      id: "music:Main Title",
      title: "Main Title",
      where: "Battle · Main Title",
      track: track("Main Title"),
    });
  });
});

describe("shuffle", () => {
  const pool = ["a", "b", "c", "d"].map(track);

  test("every song once, in some order", () => {
    const queue = shuffledQueue(pool, null, randoms(0.9, 0.1, 0.5));
    expect(queue.map((t) => t.key).sort()).toEqual(pool.map((t) => t.key).sort());
  });

  test("a new round never starts with the song playing now", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(shuffledQueue(pool, "music:a.mp3", () => r)[0]!.key).not.toBe("music:a.mp3");
    }
  });

  test("one song is all there is to play", () => {
    expect(shuffledQueue([track("a")], "music:a.mp3")[0]!.key).toBe("music:a.mp3");
    expect(nextShuffled([], [track("a")], "music:a.mp3").track?.key).toBe("music:a.mp3");
  });

  test("plays the queue down, then deals a new round", () => {
    let queue: Track[] = [];
    let playing: string | null = null;
    const heard: string[] = [];
    for (let turn = 0; turn < 8; turn += 1) {
      const next = nextShuffled(queue, pool, playing, randoms(0.3, 0.7, 0.1));
      heard.push(next.track!.key);
      playing = next.track!.key;
      queue = next.queue;
    }
    expect(new Set(heard.slice(0, 4)).size).toBe(4);
    expect(new Set(heard.slice(4)).size).toBe(4);
    for (let index = 1; index < heard.length; index += 1) expect(heard[index]).not.toBe(heard[index - 1]);
  });

  test("a song no longer in the pool drops out of the queue", () => {
    const next = nextShuffled([track("gone"), track("b")], pool, null);
    expect(next.track?.key).toBe("music:b.mp3");
  });

  test("nothing earned plays nothing", () => {
    expect(nextShuffled([], [], null).track).toBeNull();
  });
});

test("a song's clock", () => {
  expect(clockOf(0)).toBe("0:00");
  expect(clockOf(65.9)).toBe("1:05");
  expect(clockOf(181)).toBe("3:01");
  expect(clockOf(-2)).toBe("0:00");
});

describe("where it draws", () => {
  const report = { x: 900, y: 5, width: 44, height: 30 };
  const icon = musicSlotBeside(report);

  test("the music button sits just left of the Report button", () => {
    expect(icon).toEqual({ x: 848, y: 5, width: 44, height: 30 });
  });

  test("Now playing opens out to the left, sized to its text and kept clear of the bar's other things", () => {
    expect(nowPlayingPill(icon, 200, 0)).toEqual({ x: 892 - 262, y: 5, width: 262, height: 30 });
    expect(nowPlayingPill(icon, 2000, 500).x).toBe(500);
    expect(nowPlayingPill(icon, 2000, 900).width).toBe(44);
  });

  test("a phone's notification spans the screen under the bar", () => {
    expect(nowPlayingBanner({ x: 300, y: 5, width: 40, height: 30 }, 390)).toEqual({
      x: 8,
      y: 45,
      width: 374,
      height: 56,
    });
  });

  test("a phone's player fills the screen under the bar", () => {
    expect(playerPanelRect(icon, { width: 390, height: 844 }, true, 3)).toEqual({
      x: 0,
      y: 41,
      width: 390,
      height: 803,
    });
  });

  test("a desktop popover hangs from the button, inside the screen", () => {
    const rect = playerPanelRect(icon, { width: 1440, height: 900 }, false, 3);
    expect(rect.x + rect.width).toBe(892);
    expect(rect.y).toBe(43);
    expect(rect.width).toBe(380);
    const many = playerPanelRect(icon, { width: 1440, height: 600 }, false, 40);
    expect(many.y + many.height).toBe(592);
    const nearLeft = playerPanelRect({ x: 20, y: 5, width: 44, height: 30 }, { width: 1440, height: 900 }, false, 3);
    expect(nearLeft.x).toBe(8);
  });
});
