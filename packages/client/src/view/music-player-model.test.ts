import { describe, expect, it } from "vitest";
import type { Track } from "../audio/music-catalog.js";
import { musicPlayerModelOf } from "./music-player-model.js";

const track = { key: "title/main", file: "x.mp3" } as unknown as Track;

describe("musicPlayerModelOf", () => {
  const song = { id: "a", title: "Main Title", where: "Title screen", track };
  const base = {
    phone: false,
    icon: { x: 1290, y: 10, width: 44, height: 34 },
    songs: [song],
    locked: 3,
    playing: track,
    paused: false,
    shuffle: false,
    volume: 40,
    withSlider: true,
  };

  it("reads what is playing, marks its row and offers the slider on a desktop", () => {
    const model = musicPlayerModelOf(base);
    expect(model.nowPlaying.song).toBeTruthy();
    expect(model.list.tracks[0]!.playing).toBe(true);
    expect(model.volume!.label).toBe("40%");
    expect(model.closeLabel).toBe("✕");
    expect(model.earned).toBe("1 of 4 earned");
    expect(model.anchor).toEqual(base.icon);
    expect(model.controls.reason).toBe("");
  });

  it("dims Shuffle and Next with a reason when no song is earned, and has no slider on a phone", () => {
    const model = musicPlayerModelOf({ ...base, songs: [], playing: null, phone: true, withSlider: false });
    expect(model.controls.reason).toBeTruthy();
    expect(model.volume).toBeNull();
    expect(model.closeLabel).toContain("Back");
    expect(model.nowPlaying.song).toBeNull();
  });

  it("says Play and reads Pause as chosen while paused", () => {
    const model = musicPlayerModelOf({ ...base, paused: true });
    expect(model.controls.paused).toBe(true);
    expect(model.nowPlaying.status).not.toBe(musicPlayerModelOf(base).nowPlaying.status);
  });
});
