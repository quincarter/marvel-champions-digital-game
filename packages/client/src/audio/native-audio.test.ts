import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NativeAudio,
  nativeAudio,
  nativeAudioFor,
  setNativeMuted,
  startNativeAudio,
  type NativeAudioBridge,
} from "./native-audio.js";

const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/152.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";

function fakeBridge(available = true) {
  const calls: string[] = [];
  let ended: (id: number) => void = () => {};
  const bridge: NativeAudioBridge = {
    available: vi.fn(async () => available),
    load: vi.fn(async (key) => {
      calls.push(`load ${key}`);
      return 120;
    }),
    play: vi.fn(async (id, key, volume, looped, music) => {
      calls.push(`play ${id} ${key} ${volume} ${looped} ${music}`);
    }),
    setVolume: vi.fn(async (id, volume) => {
      calls.push(`volume ${id} ${volume}`);
    }),
    setPaused: vi.fn(async (id, paused) => {
      calls.push(`paused ${id} ${paused}`);
    }),
    stop: vi.fn(async (id) => {
      calls.push(`stop ${id}`);
    }),
    onEnded: vi.fn(async (listener) => {
      ended = listener;
      return () => {};
    }),
  };
  return { bridge, calls, end: (id: number) => ended(id) };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("nativeAudioFor", () => {
  it("is only the Linux desktop app", async () => {
    for (const [isTauri, ua] of [
      [true, WINDOWS],
      [true, MAC],
      [true, ANDROID],
      [false, LINUX],
    ] as const) {
      const { bridge } = fakeBridge();
      expect(await nativeAudioFor(isTauri, ua, bridge)).toBeNull();
      expect(bridge.available).not.toHaveBeenCalled();
    }
    expect(await nativeAudioFor(true, LINUX, fakeBridge().bridge)).toBeInstanceOf(NativeAudio);
  });

  it("leaves the sound to Phaser when the shell cannot reach the audio server", async () => {
    expect(await nativeAudioFor(true, LINUX, fakeBridge(false).bridge)).toBeNull();
    const broken = fakeBridge().bridge;
    broken.available = async () => {
      throw new Error("no such command");
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await nativeAudioFor(true, LINUX, broken)).toBeNull();
  });
});

describe("startNativeAudio", () => {
  it("starts muted when Sound was saved off and synced before the probe resolved", async () => {
    const { bridge, calls } = fakeBridge();
    let release: (available: boolean) => void = () => {};
    bridge.available = () => new Promise<boolean>((resolve) => (release = resolve));
    const started = startNativeAudio(true, LINUX, bridge);
    // MusicScene.create() syncs the settings while the probe is still out.
    expect(nativeAudio()).toBeNull();
    setNativeMuted(true);
    release(true);
    const audio = (await started)!;
    const sound = audio.add("sfx:x", { volume: 0.5 });
    sound.play();
    await vi.waitFor(() => expect(calls).toContain(`play ${sound.id} sfx:x 0 false false`));
    setNativeMuted(false);
  });
});

describe("NativeAudio", () => {
  it("loads a file once, then makes sounds that play it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })),
    );
    const { bridge, calls } = fakeBridge();
    const audio = new NativeAudio(bridge);
    expect(audio.has("a")).toBe(false);
    await Promise.all([audio.load("a", "/a.mp3"), audio.load("a", "/a.mp3")]);
    await audio.load("a", "/a.mp3");
    expect(calls.filter((c) => c.startsWith("load"))).toEqual(["load a"]);
    expect(audio.has("a")).toBe(true);

    const sound = audio.add("a", { loop: true, volume: 0.5 });
    expect(sound.duration).toBe(120);
    sound.play();
    await Promise.resolve();
    await vi.waitFor(() => expect(calls).toContain(`play ${sound.id} a 0.5 true true`));
  });

  it("rejects a file the page cannot fetch, for the caller to fall back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    const audio = new NativeAudio(fakeBridge().bridge);
    await expect(audio.load("a", "/missing.mp3")).rejects.toThrow("404");
    expect(audio.has("a")).toBe(false);
  });

  it("sends the mute as silence, and tells a finished sound's listeners", async () => {
    const { bridge, calls, end } = fakeBridge();
    const audio = new NativeAudio(bridge);
    const sound = audio.add("sfx:x", { volume: 0.8 });
    const done = vi.fn();
    sound.once("complete", done);
    sound.play();
    expect(sound.isPlaying).toBe(true);
    await vi.waitFor(() => expect(calls).toContain(`play ${sound.id} sfx:x 0.8 false false`));
    audio.muted = true;
    await vi.waitFor(() => expect(calls).toContain(`volume ${sound.id} 0`));
    end(sound.id);
    expect(done).toHaveBeenCalledTimes(1);
    expect(sound.isPlaying).toBe(false);
  });

  it("pauses, resumes and stops in order, and keeps its place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })),
    );
    const { bridge, calls } = fakeBridge();
    const audio = new NativeAudio(bridge);
    await audio.load("m", "/m.mp3");
    vi.useFakeTimers();
    const sound = audio.add("m", { loop: true });
    sound.play();
    vi.advanceTimersByTime(10_000);
    sound.pause();
    expect(sound.isPaused).toBe(true);
    expect(sound.isPlaying).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(sound.seek).toBeCloseTo(10, 0);
    sound.resume();
    expect(sound.isPlaying).toBe(true);
    vi.advanceTimersByTime(115_000);
    // 125 s into a 120 s loop.
    expect(sound.seek).toBeCloseTo(5, 0);
    sound.destroy();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map((c) => c.split(" ")[0])).toEqual(["load", "play", "paused", "paused", "stop"]);
  });
});
