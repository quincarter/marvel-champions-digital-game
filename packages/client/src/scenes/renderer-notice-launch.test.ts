import { beforeEach, describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";

// The notice is due: the game fell back to Canvas and it has not been closed.
vi.mock("../platform/renderer-options.js", () => ({ canvasFallbackInUse: () => true }));

/** A Title stand-in: a clock the test moves, a manager whose `active` set the test controls, and its shutdown. */
function fakeTitle() {
  const active = new Set<string>();
  const shutdown: (() => void)[] = [];
  let tick: (() => void) | null = null;
  const clock = { now: 0 };
  const scene = {
    input: { enabled: true },
    sys: { isActive: () => true },
    time: {
      get now() {
        return clock.now;
      },
      addEvent: (config: { callback: () => void }) => {
        tick = config.callback;
        return { remove: () => (tick = null) };
      },
    },
    events: { once: (_: string, listener: () => void) => shutdown.push(listener) },
    scene: {
      manager: { isActive: (key: string) => active.has(key), stop: (key: string) => active.delete(key) },
      launch: vi.fn(),
    },
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    raw: scene,
    active,
    advance: (ms: number) => {
      clock.now += ms;
      tick?.();
    },
    leave: () => shutdown.forEach((listener) => listener()),
  };
}

describe("the notice's launch over Title", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage?.clear?.();
  });

  test("holds Title until the overlay is up, then gives it back", async () => {
    const launch = await import("./renderer-notice-launch.js");
    const title = fakeTitle();
    expect(launch.maybeShowRendererNotice(title.scene)).toBe(true);
    expect(title.raw.input.enabled).toBe(false);
    expect(launch.rendererNoticePending()).toBe(true);
    title.active.add("RendererNoticeOverlay");
    title.advance(50);
    expect(launch.rendererNoticePending()).toBe(false);
    expect(title.raw.input.enabled).toBe(true);
    expect(launch.rendererNoticeWanted()).toBe(true);
  });

  test("a load that never arrives in time is given up: a late start closes itself", async () => {
    const launch = await import("./renderer-notice-launch.js");
    const title = fakeTitle();
    launch.maybeShowRendererNotice(title.scene);
    title.advance(16_000);
    expect(launch.rendererNoticePending()).toBe(false);
    expect(title.raw.input.enabled).toBe(true);
    expect(launch.rendererNoticeWanted()).toBe(false);
  });

  test("Title leaving before the overlay is up gives the launch up", async () => {
    const launch = await import("./renderer-notice-launch.js");
    const title = fakeTitle();
    launch.maybeShowRendererNotice(title.scene);
    title.leave();
    expect(launch.rendererNoticePending()).toBe(false);
    expect(launch.rendererNoticeWanted()).toBe(false);
  });
});
