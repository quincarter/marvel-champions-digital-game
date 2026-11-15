import { describe, expect, test } from "vitest";
import { PictureWait, settleWithin } from "./picture-wait.js";

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A texture manager stand-in: the keys that are in. */
const textures = (): { loaded: Set<string>; isLoaded: (key: string) => boolean } => {
  const loaded = new Set<string>();
  return { loaded, isLoaded: (key) => loaded.has(key) };
};

describe("PictureWait (issue #716)", () => {
  test("nothing expected: settled at once", async () => {
    const wait = new PictureWait(textures().isLoaded);
    let done = false;
    void wait.settled().then(() => (done = true));
    await flush();
    expect(done).toBe(true);
    expect(wait.pending).toBe(false);
  });

  test("an expected picture holds the wait until it arrives", async () => {
    const t = textures();
    const wait = new PictureWait(t.isLoaded);
    wait.expect("klaw");
    let done = false;
    void wait.settled().then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    expect(wait.pending).toBe(true);
    t.loaded.add("klaw");
    wait.arrived();
    await flush();
    expect(done).toBe(true);
    expect(wait.pending).toBe(false);
  });

  test("two portraits arriving in separate batches settle only after the second (#713 review)", async () => {
    // The Mod Store's notice waits for Deadpool and Spider-Man; the loader tells one callback per batch of 300 ms.
    const t = textures();
    const wait = new PictureWait(t.isLoaded);
    wait.expect("deadpool");
    wait.expect("spider-man");
    let done = false;
    void wait.settled().then(() => (done = true));
    t.loaded.add("deadpool");
    wait.arrived();
    await flush();
    expect(done).toBe(false);
    expect(wait.pending).toBe(true);
    t.loaded.add("spider-man");
    wait.arrived();
    await flush();
    expect(done).toBe(true);
  });

  test("a picture already in is not waited for", async () => {
    const t = textures();
    t.loaded.add("thor");
    const wait = new PictureWait(t.isLoaded);
    wait.expect("thor");
    expect(wait.pending).toBe(false);
    await expect(wait.settled()).resolves.toBeUndefined();
  });

  test("several waiters on one wait share one promise and settle together", async () => {
    const t = textures();
    const wait = new PictureWait(t.isLoaded);
    wait.expect("a");
    const first = wait.settled();
    expect(wait.settled()).toBe(first);
    let settled = 0;
    void first.then(() => settled++);
    void wait.settled().then(() => settled++);
    t.loaded.add("a");
    wait.arrived();
    await flush();
    expect(settled).toBe(2);
  });

  test("a picture expected after a wait settled starts a new wait", async () => {
    const t = textures();
    const wait = new PictureWait(t.isLoaded);
    wait.expect("a");
    const first = wait.settled();
    t.loaded.add("a");
    wait.arrived();
    await first;
    wait.expect("b");
    let done = false;
    void wait.settled().then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    t.loaded.add("b");
    wait.arrived();
    await flush();
    expect(done).toBe(true);
  });

  test("arrived is one stable function, so a loader can de-duplicate it", () => {
    const wait = new PictureWait(textures().isLoaded);
    expect(wait.arrived).toBe(wait.arrived);
  });
});

describe("settleWithin", () => {
  test("settles when the promise does", async () => {
    let fire: (() => void) | null = null;
    const timer = (callback: () => void): void => {
      fire = callback;
    };
    let done = false;
    void settleWithin(Promise.resolve(), 450, timer).then(() => (done = true));
    await flush();
    expect(done).toBe(true);
    expect(fire).not.toBeNull();
  });

  test("settles at the deadline when the promise never does", async () => {
    let fire: (() => void) | null = null;
    const timer = (callback: () => void): void => {
      fire = callback;
    };
    let done = false;
    void settleWithin(new Promise(() => undefined), 450, timer).then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    fire!();
    await flush();
    expect(done).toBe(true);
  });

  test("a rejected promise settles it too, never rejects", async () => {
    await expect(settleWithin(Promise.reject(new Error("no picture")), 450, () => undefined)).resolves.toBeUndefined();
  });
});
