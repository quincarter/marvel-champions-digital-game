import { afterEach, describe, expect, it, vi } from "vitest";
import type { PackManifest } from "@mc/content";
import { loadInWorker, type LoadWorkerLike } from "./load-client.js";
import { NO_REQUIRED_CONTENT } from "./pack-load.js";
import { setLoadedPacks, loadedPacks, onLoadedPacksChange } from "./pack-registry.js";
import { poolViewOfPacks } from "../content/pool.js";
import { gameDeps, setGamePacks } from "../content/game-deps.js";
import type { PackRuntime } from "./pack-runtime.js";

afterEach(() => {
  vi.useRealTimers();
  setGamePacks(undefined);
  setLoadedPacks([]);
});

const silentWorker = (): LoadWorkerLike => ({
  postMessage: () => undefined,
  onmessage: null,
  onerror: null,
  terminate: () => undefined,
});

describe("a worker that goes silent after the files were handed over", () => {
  it("is answered on this thread from a fresh read of the files", async () => {
    const manifest = {
      id: "demo",
      version: "1.0.0",
      files: [],
      contents: { cards: "cards" },
    } as unknown as PackManifest;
    const reread = vi.fn(async () => new Map<string, Uint8Array>());
    const result = await loadInWorker(
      manifest,
      new Map([["a", new Uint8Array(2)]]),
      NO_REQUIRED_CONTENT,
      silentWorker,
      5,
      reread,
    );
    expect(reread).toHaveBeenCalledTimes(1);
    // The pack here is empty, so it fails validation here: the point is that the load ran, not that the loader gave up.
    expect(result.ok === false && result.reason).not.toBe("The pack loader stopped before it finished");
  });

  it("says the loader stopped when it cannot read the files again", async () => {
    const manifest = { id: "demo", version: "1.0.0", files: [] } as unknown as PackManifest;
    const result = await loadInWorker(
      manifest,
      new Map([["a", new Uint8Array(2)]]),
      NO_REQUIRED_CONTENT,
      silentWorker,
      5,
      async () => {
        throw new Error("gone");
      },
    );
    expect(result).toEqual({ ok: false, reason: "The pack loader stopped before it finished" });
  });
});

describe("the loaded set and the game's packs", () => {
  const pack = (version: string): PackRuntime => ({
    id: "p",
    version,
    name: "P",
    requires: [],
    cards: [],
    abilities: {},
    decks: [],
  });

  it("does not notify when nothing was loaded and nothing is", () => {
    const heard = vi.fn();
    const off = onLoadedPacksChange(heard);
    setLoadedPacks([]);
    expect(heard).not.toHaveBeenCalled();
    setLoadedPacks([pack("1.0.0")]);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(loadedPacks()).toHaveLength(1);
    off();
  });

  it("builds the merged pool once for the same packs arriving in a new array each snapshot", () => {
    setGamePacks([pack("1.0.0")]);
    const first = gameDeps();
    setGamePacks([pack("1.0.0")]);
    expect(gameDeps()).toBe(first);
    expect(poolViewOfPacks([pack("1.0.0")]).deps).toBeDefined();
    setGamePacks([pack("1.1.0")]);
    expect(gameDeps()).not.toBe(first);
  });
});
