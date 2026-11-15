import { beforeEach, describe, expect, it, vi } from "vitest";

const loader = vi.hoisted(() => ({
  registered: new Set<string>(),
  load: vi.fn<(key: string) => Promise<void>>(),
}));
const paint = vi.hoisted(() => ({ waiting: 0, held: new Set<unknown>(), paintedOnMain: [] as unknown[] }));

vi.mock("../session.js", () => ({ appSession: () => ({ settings: { reducedMotion: false } }) }));
vi.mock("../scenes/scene-loader.js", () => ({
  isStartPending: () => false,
  LAZY_SCENE_KEYS: ["Extras", "Broken"],
  sceneLoader: () => ({ load: loader.load, isRegistered: (key: string) => loader.registered.has(key) }),
}));
vi.mock("../scenes/scene-order.js", () => ({ needed: (key: string) => [key] }));
vi.mock("./lazy-text.js", () => ({
  prewarmTextPainter: () => undefined,
  labelsWaitingForPaint: () => paint.waiting,
  holdLabelsOnMain: (scene: unknown, held: boolean) => {
    if (held) paint.paintedOnMain.push(scene);
    return held ? paint.held.add(scene) : paint.held.delete(scene);
  },
}));

const { fadeScreenIn, goToScreen, holdScreenFor, isScreenHeld, revealWhenPainted } = await import("./transitions.js");

type Handler = (...args: unknown[]) => void;

/** Just enough of a Phaser scene for the transitions: events, a camera whose fades are recorded, and `scene.start`. */
function fakeScene() {
  const handlers = new Map<string, Set<Handler>>();
  const on = (name: string, fn: Handler): void => {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name)!.add(fn);
  };
  const off = (name: string, fn: Handler): void => void handlers.get(name)?.delete(fn);
  const emit = (name: string): void => {
    for (const fn of [...(handlers.get(name) ?? [])]) fn();
  };
  const fades: { direction: "in" | "out"; durationMs: number }[] = [];
  const cameraEvents = new Map<string, Handler>();
  const fadeEffect = { isRunning: false, direction: false, _elapsed: 0 };
  const loop = { frame: 1 };
  let active = true;
  const scene = {
    events: {
      on,
      off,
      once: (name: string, fn: Handler) => {
        const wrapped: Handler = (...args) => {
          off(name, wrapped);
          fn(...args);
        };
        on(name, wrapped);
      },
    },
    cameras: {
      main: {
        fadeEffect,
        fadeIn: (durationMs: number) => {
          fades.push({ direction: "in", durationMs });
          Object.assign(fadeEffect, { isRunning: true, direction: false });
        },
        fadeOut: (durationMs: number) => {
          fades.push({ direction: "out", durationMs });
          Object.assign(fadeEffect, { isRunning: true, direction: true });
        },
        once: (name: string, fn: Handler) => cameraEvents.set(name, fn),
      },
    },
    sys: { game: { loop }, isActive: () => active },
    tweens: { add: vi.fn() },
    scene: { start: vi.fn() },
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    start: scene.scene.start,
    tweens: scene.tweens.add,
    reopen: () => {
      active = true;
    },
    fades,
    loop,
    emit,
    finishFadeOut: () => cameraEvents.get("camerafadeoutcomplete")?.(),
    shutdown: () => {
      active = false;
      emit("shutdown");
    },
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  loader.registered.clear();
  loader.load.mockReset();
  paint.waiting = 0;
  paint.held.clear();
});

describe("goToScreen", () => {
  it("loads the next screen's code before it fades out", async () => {
    let arrive: () => void = () => undefined;
    loader.load.mockReturnValue(new Promise<void>((resolve) => (arrive = resolve)));
    const screen = fakeScene();
    goToScreen(screen.scene, "Extras");
    goToScreen(screen.scene, "Extras"); // a second tap while it loads
    expect(screen.fades).toEqual([]);
    loader.registered.add("Extras");
    arrive();
    await flush();
    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(screen.fades).toEqual([{ direction: "out", durationMs: 200 }]);
    screen.finishFadeOut();
    expect(screen.start).toHaveBeenCalledWith("Extras", {});
  });

  it("tries a chunk that fails to load once, then leaves it to the scene loader", async () => {
    loader.load.mockRejectedValue(new Error("404"));
    const screen = fakeScene();
    goToScreen(screen.scene, "Broken");
    await flush();
    await flush();
    expect(loader.load).toHaveBeenCalledTimes(1);
    screen.finishFadeOut();
    expect(screen.start).toHaveBeenCalledWith("Broken", {});
  });

  it("drops a tap whose screen was left before the code arrived", async () => {
    let arrive: () => void = () => undefined;
    loader.load.mockReturnValue(new Promise<void>((resolve) => (arrive = resolve)));
    const screen = fakeScene();
    goToScreen(screen.scene, "Extras");
    screen.shutdown();
    arrive();
    await flush();
    expect(screen.fades).toEqual([]);
    expect(screen.start).not.toHaveBeenCalled();
  });

  it("a later visit of the same screen instance isn't blocked by, or sent on by, the earlier tap", async () => {
    let arrive: () => void = () => undefined;
    loader.load.mockReturnValue(new Promise<void>((resolve) => (arrive = resolve)));
    const screen = fakeScene();
    goToScreen(screen.scene, "Extras");
    screen.shutdown();
    screen.reopen();
    loader.registered.add("Extras");
    goToScreen(screen.scene, "Extras", { tab: "music" });
    screen.finishFadeOut();
    arrive();
    await flush();
    expect(screen.fades).toEqual([{ direction: "out", durationMs: 200 }]);
    expect(screen.start).toHaveBeenCalledTimes(1);
    expect(screen.start).toHaveBeenCalledWith("Extras", { tab: "music" });
  });
});

describe("revealWhenPainted", () => {
  const object = () => ({
    type: "Graphics",
    alpha: 0.5,
    y: 0,
    scene: {},
    setAlpha(value: number) {
      this.alpha = value;
    },
  });

  it("hides the objects until their labels are painted, then fades them back to their own alpha", () => {
    const screen = fakeScene();
    const tile = object();
    paint.waiting = 2;
    revealWhenPainted(screen.scene, [tile as unknown as Phaser.GameObjects.GameObject]);
    expect(tile.alpha).toBe(0);
    screen.emit("postupdate");
    expect(screen.tweens).not.toHaveBeenCalled();
    paint.waiting = 0;
    screen.emit("postupdate");
    expect(screen.tweens).toHaveBeenCalledWith(expect.objectContaining({ targets: tile, alpha: 0.5 }));
  });

  it("shows them anyway once the cap has passed", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const screen = fakeScene();
    const tile = object();
    paint.waiting = 2;
    revealWhenPainted(screen.scene, [tile as unknown as Phaser.GameObjects.GameObject]);
    now.mockReturnValue(1300);
    screen.emit("postupdate");
    expect(screen.tweens).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });
});

describe("holdScreenFor", () => {
  it("keeps the screen on the void until its data is in and a render has painted its labels", async () => {
    const screen = fakeScene();
    fadeScreenIn(screen.scene);
    let arrive: () => void = () => undefined;
    holdScreenFor(screen.scene, new Promise<void>((resolve) => (arrive = resolve)));
    // Its labels are painted by the text worker while it is held, not on the main thread (issue #722): the screen waits
    // for them below, but no frame builds them all.
    expect(paint.held.has(screen.scene)).toBe(false);
    screen.emit("render");
    expect(screen.fades.at(-1)?.durationMs).toBeGreaterThan(10_000); // still held
    arrive();
    await flush();
    paint.waiting = 3;
    screen.emit("render");
    expect(screen.fades.at(-1)?.durationMs).toBeGreaterThan(10_000);
    paint.waiting = 0;
    screen.emit("render");
    expect(screen.fades.at(-1)).toEqual({ direction: "in", durationMs: 200 });
    expect(paint.held.has(screen.scene)).toBe(false);
  });

  it("fades in anyway once the cap has passed", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const screen = fakeScene();
    fadeScreenIn(screen.scene);
    holdScreenFor(screen.scene, new Promise<void>(() => undefined));
    now.mockReturnValue(1460);
    screen.emit("render");
    expect(screen.fades.at(-1)).toEqual({ direction: "in", durationMs: 200 });
    now.mockRestore();
  });

  it("at the cap, labels the worker hasn't painted yet are painted here, so the screen still fades in whole (#722)", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const screen = fakeScene();
    fadeScreenIn(screen.scene);
    holdScreenFor(screen.scene, Promise.resolve());
    paint.paintedOnMain.length = 0;
    paint.waiting = 2;
    now.mockReturnValue(1460);
    screen.emit("render");
    expect(paint.paintedOnMain).toEqual([screen.scene]);
    expect(screen.fades.at(-1)).toEqual({ direction: "in", durationMs: 200 });
    paint.waiting = 0;
    now.mockRestore();
  });

  it("says whether a screen is held", () => {
    const screen = fakeScene();
    fadeScreenIn(screen.scene);
    expect(isScreenHeld(screen.scene)).toBe(false);
    holdScreenFor(screen.scene, new Promise<void>(() => undefined));
    expect(isScreenHeld(screen.scene)).toBe(true);
  });

  it("does nothing once the entrance has begun", () => {
    const screen = fakeScene();
    fadeScreenIn(screen.scene);
    screen.loop.frame = 2;
    holdScreenFor(screen.scene, new Promise<void>(() => undefined));
    expect(screen.fades).toEqual([{ direction: "in", durationMs: 200 }]);
    expect(paint.held.has(screen.scene)).toBe(false);
  });

  it("leaving a held screen starts the next one at once: there is nothing on screen to fade out", () => {
    const screen = fakeScene();
    fadeScreenIn(screen.scene);
    holdScreenFor(screen.scene, new Promise<void>(() => undefined));
    loader.registered.add("Extras");
    goToScreen(screen.scene, "Extras");
    expect(screen.start).toHaveBeenCalledWith("Extras", {});
    expect(paint.held.has(screen.scene)).toBe(false);
  });
});
