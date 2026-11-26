// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { domFocusRing } from "./dom-ring.js";

type Handler = () => void;

function fakeScene(camera: { fadeAlpha: number; fading: boolean }) {
  const handlers = new Map<string, Handler[]>();
  const events = {
    on: (name: string, fn: Handler, ctx: unknown) => {
      const list = handlers.get(name) ?? [];
      list.push(fn.bind(ctx));
      handlers.set(name, list);
    },
    once: () => {},
    off: () => {},
  };
  const settings = { key: "Credits", visible: true };
  const sys = { settings, isActive: () => true, isPaused: () => false };
  const scene = {
    events,
    sys,
    game: { scene: { scenes: [{ sys }] } },
    cameras: {
      main: {
        alpha: 1,
        get fadeEffect() {
          return { isRunning: camera.fading, isComplete: false, alpha: camera.fadeAlpha };
        },
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, emit: (name: string) => handlers.get(name)?.forEach((fn) => fn()) };
}

const rect = { x: 10, y: 20, width: 100, height: 40 };

describe("domFocusRing pulse and camera fade", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps the camera opacity on the wrapper and pulses only the inner element", () => {
    const camera = { fadeAlpha: 0, fading: false };
    const { scene, emit } = fakeScene(camera);
    const ring = domFocusRing(scene, undefined);
    ring.show(rect, "pulse", false);
    const wrapper = document.querySelector<HTMLElement>(".mc-focus-ring")!;
    const inner = wrapper.firstElementChild as HTMLElement;
    expect(inner.style.animation).toContain("mc-ring-pulse");
    expect(wrapper.style.animation).toBe("");
    expect(wrapper.style.opacity).toBe("1");

    camera.fading = true;
    camera.fadeAlpha = 0.6;
    emit("postupdate");
    expect(wrapper.style.opacity).toBe("0.4");
    expect(inner.style.opacity).toBe("");
    camera.fadeAlpha = 1;
    emit("postupdate");
    expect(wrapper.style.opacity).toBe("0");
    expect(inner.style.animation).toContain("mc-ring-pulse");
  });

  it("does not pulse under reduced motion, and the wrapper still fades", () => {
    const camera = { fadeAlpha: 0.5, fading: true };
    const { scene } = fakeScene(camera);
    const ring = domFocusRing(scene, undefined);
    ring.show(rect, "pulse", true);
    const wrapper = document.querySelector<HTMLElement>(".mc-focus-ring")!;
    const inner = wrapper.firstElementChild as HTMLElement;
    expect(inner.style.animation).toBe("none");
    expect(wrapper.style.opacity).toBe("0.5");
  });
});
