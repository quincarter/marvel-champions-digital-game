import { describe, expect, it } from "vitest";
import { setStartupPacksLoad, startupPacksLoaded } from "./startup-packs.js";

describe("startupPacksLoaded (#858)", () => {
  it("waits for the startup pack load", async () => {
    let finish: () => void = () => undefined;
    setStartupPacksLoad(new Promise<void>((resolve) => (finish = resolve)));
    let done = false;
    const waiting = startupPacksLoaded().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    await waiting;
    expect(done).toBe(true);
  });

  it("settles when the load fails, or takes too long", async () => {
    setStartupPacksLoad(Promise.reject(new Error("bad pack")));
    await expect(startupPacksLoaded()).resolves.toBeUndefined();
    setStartupPacksLoad(new Promise(() => undefined));
    await expect(startupPacksLoaded(5)).resolves.toBeUndefined();
  });
});
