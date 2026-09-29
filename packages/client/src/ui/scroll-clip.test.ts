import { describe, expect, test } from "vitest";
import type Phaser from "phaser";
import { clipRowInteractivity, setAllInteractiveEnabled, setInteractiveEnabled } from "./scroll-clip.js";

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
