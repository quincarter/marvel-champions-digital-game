import { describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { countTween } from "./bound-tween.js";

/** Just enough of a scene and a game object to drive `countTween` without a canvas. */
function fakes() {
  let config: { onUpdate: () => void; targets: { value: number } } | null = null;
  const tween = { remove: vi.fn() };
  const scene = {
    tweens: {
      add: (c: typeof config) => {
        config = c;
        return tween;
      },
    },
  } as unknown as Phaser.Scene;
  const listeners = new Map<string, () => void>();
  const owner = {
    active: true,
    scene: {},
    once: (event: string, fn: () => void) => listeners.set(event, fn),
  };
  return {
    scene,
    owner,
    tween,
    step: (value: number) => {
      config!.targets.value = value;
      config!.onUpdate();
    },
    destroy: () => {
      owner.active = false;
      owner.scene = null as unknown as object;
      listeners.get("destroy")?.();
    },
  };
}

describe("countTween", () => {
  test("steps its owner from the start value on every update", () => {
    const f = fakes();
    const seen: number[] = [];
    countTween(f.scene, f.owner as unknown as Phaser.GameObjects.GameObject, {
      from: 9,
      to: 6,
      durationMs: 300,
      onStep: (v) => seen.push(v),
    });
    f.step(8);
    f.step(6);
    expect(seen).toEqual([9, 8, 6]);
  });

  test("destroying the owner removes the tween, and a late update never reaches the destroyed owner (the 'Hawkeye is down' freeze)", () => {
    const f = fakes();
    const onStep = vi.fn();
    countTween(f.scene, f.owner as unknown as Phaser.GameObjects.GameObject, {
      from: 3,
      to: 0,
      durationMs: 300,
      onStep,
    });
    onStep.mockClear();
    f.destroy();
    expect(f.tween.remove).toHaveBeenCalled();
    f.step(1);
    expect(onStep).not.toHaveBeenCalled();
  });
});
