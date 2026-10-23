import { describe, expect, test } from "vitest";
import type Phaser from "phaser";
import {
  clipRowInteractivity,
  clipToViewport,
  setAllInteractiveEnabled,
  setInteractiveEnabled,
} from "./scroll-clip.js";

/** A minimal stand-in for an interactive `Phaser.GameObjects.GameObject` — only what `setInteractiveEnabled` reads. */
function fakeZone(): { input: { enabled: boolean } } {
  return { input: { enabled: true } };
}

/** A minimal stand-in for a `Container` holding zones (and, potentially, nested containers). */
function fakeContainer(list: readonly unknown[]): { list: readonly unknown[] } {
  return { list };
}

describe("setInteractiveEnabled", () => {
  test("toggles a plain interactive object's own input.enabled", () => {
    const zone = fakeZone();
    setInteractiveEnabled(zone as unknown as Phaser.GameObjects.GameObject, false);
    expect(zone.input.enabled).toBe(false);
    setInteractiveEnabled(zone as unknown as Phaser.GameObjects.GameObject, true);
    expect(zone.input.enabled).toBe(true);
  });

  test("leaves a non-interactive object (no .input) alone rather than throwing", () => {
    const label = {};
    expect(() => setInteractiveEnabled(label as unknown as Phaser.GameObjects.GameObject, false)).not.toThrow();
  });

  test("recurses into a Container's own children, including nested containers", () => {
    const innerZone = fakeZone();
    const outerZone = fakeZone();
    const inner = fakeContainer([innerZone]);
    const outer = fakeContainer([outerZone, inner]);
    setInteractiveEnabled(outer as unknown as Phaser.GameObjects.GameObject, false);
    expect(outerZone.input.enabled).toBe(false);
    expect(innerZone.input.enabled).toBe(false);
  });
});

describe("setAllInteractiveEnabled", () => {
  test("applies to every object in a flat list, e.g. a scroll region's own content.list", () => {
    const a = fakeZone();
    const b = fakeZone();
    setAllInteractiveEnabled([a, b] as unknown as Phaser.GameObjects.GameObject[], false);
    expect(a.input.enabled).toBe(false);
    expect(b.input.enabled).toBe(false);
  });
});

describe("clipRowInteractivity", () => {
  const VIEWPORT_HEIGHT = 400;
  const ROW_HEIGHT = 100;

  test("enables a row fully inside the viewport", () => {
    const zone = fakeZone();
    clipRowInteractivity([zone] as unknown as Phaser.GameObjects.GameObject[], 0, ROW_HEIGHT, VIEWPORT_HEIGHT, false);
    expect(zone.input.enabled).toBe(true);
  });

  test("disables a row entirely above the viewport (an overscan row scrolled past the top)", () => {
    const zone = fakeZone();
    clipRowInteractivity(
      [zone] as unknown as Phaser.GameObjects.GameObject[],
      -ROW_HEIGHT,
      ROW_HEIGHT,
      VIEWPORT_HEIGHT,
      false,
    );
    expect(zone.input.enabled).toBe(false);
  });

  test("disables a row entirely below the viewport (an overscan row scrolled past the bottom)", () => {
    const zone = fakeZone();
    clipRowInteractivity(
      [zone] as unknown as Phaser.GameObjects.GameObject[],
      VIEWPORT_HEIGHT,
      ROW_HEIGHT,
      VIEWPORT_HEIGHT,
      false,
    );
    expect(zone.input.enabled).toBe(false);
  });

  test("enables a row only partly inside the viewport (any pixel on screen counts)", () => {
    const zone = fakeZone();
    clipRowInteractivity(
      [zone] as unknown as Phaser.GameObjects.GameObject[],
      -ROW_HEIGHT + 1,
      ROW_HEIGHT,
      VIEWPORT_HEIGHT,
      false,
    );
    expect(zone.input.enabled).toBe(true);
  });

  test("a row fully inside the viewport is still disabled while a drag past the tap threshold is in progress", () => {
    const zone = fakeZone();
    clipRowInteractivity([zone] as unknown as Phaser.GameObjects.GameObject[], 0, ROW_HEIGHT, VIEWPORT_HEIGHT, true);
    expect(zone.input.enabled).toBe(false);
  });
});

describe("clipToViewport", () => {
  const viewport = { x: 0, y: 100, width: 300, height: 200 };
  function boundedZone(y: number, height = 44): { input: { enabled: boolean }; getBounds: () => object } {
    return { input: { enabled: true }, getBounds: () => ({ x: 10, y, width: 100, height }) };
  }

  test("enables a control wholly inside the viewport and disables one above, below or straddling an edge", () => {
    const inside = boundedZone(150);
    const above = boundedZone(20);
    const straddling = boundedZone(80);
    const below = boundedZone(320);
    clipToViewport([inside, above, straddling, below] as unknown as Phaser.GameObjects.GameObject[], viewport);
    expect([inside, above, straddling, below].map((z) => z.input.enabled)).toEqual([true, false, false, false]);
  });

  test("re-enables a control once it scrolls back inside, and walks nested containers", () => {
    const zone = boundedZone(20);
    const outer = fakeContainer([fakeContainer([zone])]);
    clipToViewport([outer] as unknown as Phaser.GameObjects.GameObject[], viewport);
    expect(zone.input.enabled).toBe(false);
    zone.getBounds = () => ({ x: 10, y: 120, width: 100, height: 44 });
    clipToViewport([outer] as unknown as Phaser.GameObjects.GameObject[], viewport);
    expect(zone.input.enabled).toBe(true);
  });

  test("a button half under the viewport's edge answers on its visible part, and on all of it once back inside", () => {
    // An aspect lesson's "Try it" half under the footer, or a Pause row half under the title bar (#365): dead before.
    const hit = { x: 0, y: 0, width: 100, height: 44 };
    const setTo = (x: number, y: number, width: number, height: number): void => {
      Object.assign(hit, { x, y, width, height });
    };
    let y = 280;
    const button = {
      input: { enabled: true, hitArea: { setTo } },
      width: 100,
      height: 44,
      getBounds: () => ({ x: 10, y, width: 100, height: 44 }),
    };
    const run = (): void => clipToViewport([button] as unknown as Phaser.GameObjects.GameObject[], viewport);
    run();
    // Bounds 280..324 against a viewport ending at 300: its top 20px.
    expect(button.input.enabled).toBe(true);
    expect(hit).toEqual({ x: 0, y: 0, width: 100, height: 20 });
    y = 200;
    run();
    expect(hit).toEqual({ x: 0, y: 0, width: 100, height: 44 });
  });

  test("a zone taller than the viewport answers on its visible part only, and is off once none of it shows", () => {
    const hit = { x: 0, y: 0, width: 100, height: 290 };
    const setTo = (x: number, y: number, width: number, height: number): void => {
      Object.assign(hit, { x, y, width, height });
    };
    let y = 50;
    const tall = {
      input: { enabled: true, hitArea: { setTo } },
      width: 100,
      height: 290,
      getBounds: () => ({ x: 10, y, width: 100, height: 290 }),
    };
    const run = (): void => clipToViewport([tall] as unknown as Phaser.GameObjects.GameObject[], viewport);
    run();
    // Bounds 50..340 against a viewport of 100..300: the middle 200px, from 50px down the zone.
    expect(tall.input.enabled).toBe(true);
    expect(hit).toEqual({ x: 0, y: 50, width: 100, height: 200 });
    y = 320;
    run();
    expect(tall.input.enabled).toBe(false);
  });
});
