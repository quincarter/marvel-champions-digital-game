import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The scale constants Phaser would give; the module only compares and assigns them.
vi.mock("phaser", () => ({
  default: {
    Scale: { RESIZE: 5, FIT: 3, NO_CENTER: 0, CENTER_BOTH: 1 },
    Structs: { Size: { NONE: 0, FIT: 2 } },
  },
}));

import { applyCouchMode, applyRenderSize, couchFactorInUse, setCouchFactorHandler } from "./render-resolution.js";
import type Phaser from "phaser";

let observers: { observed: unknown[]; disconnected: boolean; fire: () => void }[] = [];

class FakeObserver {
  readonly state = { observed: [] as unknown[], disconnected: false, fire: () => this.callback() };
  constructor(private readonly callback: () => void) {
    observers.push(this.state);
  }
  observe(target: unknown): void {
    this.state.observed.push(target);
  }
  disconnect(): void {
    this.state.disconnected = true;
  }
}

function fakeGame(parentWidth: number, parentHeight: number) {
  const parent = { clientWidth: parentWidth, clientHeight: parentHeight, style: { background: "" } };
  const gameSize = { width: parentWidth, height: parentHeight };
  const scale = {
    parent,
    scaleMode: 5,
    autoCenter: 0,
    gameSize,
    parentSize: {},
    displaySize: { setAspectMode: vi.fn(), setParent: vi.fn() },
    setGameSize: vi.fn((width: number, height: number) => Object.assign(gameSize, { width, height })),
    refresh: vi.fn(),
  };
  const canvas = { style: { marginLeft: "1px", marginTop: "1px", width: "9px", height: "9px" } };
  return { game: { scale, canvas } as unknown as Phaser.Game, scale, parent, canvas };
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("ResizeObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("couch mode in the scale manager", () => {
  test("it draws FIT at the window over the factor, follows resizes, and returns to RESIZE when off", () => {
    const { game, scale, parent, canvas } = fakeGame(1920, 1080);
    const changes: number[] = [];
    setCouchFactorHandler(() => changes.push(couchFactorInUse()));
    applyCouchMode(game, 2);
    expect(scale.scaleMode).toBe(3);
    expect(scale.setGameSize).toHaveBeenLastCalledWith(960, 540);
    expect(couchFactorInUse()).toBe(2);
    expect(observers).toHaveLength(1);
    expect(observers[0]!.observed).toEqual([parent]);

    // The window shrinks: the observer refits at the capped factor (1280 x 720 allows 1.44) and publishes it.
    parent.clientWidth = 1280;
    parent.clientHeight = 720;
    observers[0]!.fire();
    expect(scale.setGameSize).toHaveBeenLastCalledWith(889, 500);
    expect(couchFactorInUse()).toBeCloseTo(1.44);
    expect(changes.at(-1)).toBeCloseTo(1.44);

    applyCouchMode(game, 1);
    expect(scale.scaleMode).toBe(5);
    expect(canvas.style).toEqual({ marginLeft: "", marginTop: "", width: "", height: "" });
    expect(parent.style.background).toBe("");
    expect(observers[0]!.disconnected).toBe(true);
    expect(couchFactorInUse()).toBe(1);
  });

  test("on a fixed resolution it divides that, and stops following the window", () => {
    const { game, scale } = fakeGame(3840, 2160);
    applyRenderSize(game, { width: 1920, height: 1080 });
    applyCouchMode(game, 2);
    expect(scale.setGameSize).toHaveBeenLastCalledWith(960, 540);
    expect(observers.every((o) => o.disconnected)).toBe(true);
    applyRenderSize(game, null);
    applyCouchMode(game, 1);
    expect(scale.scaleMode).toBe(5);
  });
});
