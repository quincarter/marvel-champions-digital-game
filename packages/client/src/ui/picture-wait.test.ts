import { describe, expect, test } from "vitest";
import { PictureWait, settleWithin } from "./picture-wait.js";

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("PictureWait (issue #716)", () => {
  test("nothing expected: settled at once", async () => {
    const wait = new PictureWait();
    let done = false;
    void wait.settled().then(() => (done = true));
    await flush();
    expect(done).toBe(true);
    expect(wait.pending).toBe(false);
  });

  test("an expected picture holds the wait until it arrives", async () => {
    const wait = new PictureWait();
    wait.expect();
    let done = false;
    void wait.settled().then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    expect(wait.pending).toBe(true);
    wait.arrived();
    await flush();
    expect(done).toBe(true);
    expect(wait.pending).toBe(false);
  });

  test("several waiters on one batch share one promise and settle together", async () => {
    const wait = new PictureWait();
    wait.expect();
    wait.expect();
    const first = wait.settled();
    expect(wait.settled()).toBe(first);
    let settled = 0;
    void first.then(() => settled++);
    void wait.settled().then(() => settled++);
    wait.arrived();
    await flush();
    expect(settled).toBe(2);
  });

  test("a picture expected after an arrival starts a new wait", async () => {
    const wait = new PictureWait();
    wait.expect();
    const first = wait.settled();
    wait.arrived();
    await first;
    wait.expect();
    let done = false;
    void wait.settled().then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    wait.arrived();
    await flush();
    expect(done).toBe(true);
  });

  test("arrived is one stable function, so a loader can de-duplicate it", () => {
    const wait = new PictureWait();
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
