import { describe, expect, test } from "vitest";
import { signature, type SignedObject, type SignedScene } from "./idle-render.js";

const camera = { x: 0, y: 0, width: 360, height: 788, scrollX: 0, scrollY: 0, zoom: 1, rotation: 0, alpha: 1 };

function scene(children: SignedObject[], extra: Partial<SignedScene> = {}): SignedScene {
  return { key: "Board", visible: true, status: 5, cameras: [camera], children, ...extra };
}

const card = (overrides: Partial<SignedObject> = {}): SignedObject => ({
  type: "Image",
  x: 10,
  y: 20,
  alpha: 1,
  scaleX: 1,
  scaleY: 1,
  frame: { name: "__BASE", texture: { key: "card-01001" } },
  ...overrides,
});

describe("signature", () => {
  test("the same picture signs the same", () => {
    expect(signature([scene([card()])])).toBe(signature([scene([card()])]));
  });

  test("a move, a fade, a new frame, a tint or a scroll each sign differently", () => {
    const still = signature([scene([card()])]);
    for (const changed of [
      card({ x: 10.5 }),
      card({ alpha: 0.9 }),
      card({ frame: { name: "__BASE", texture: { key: "card-01002" } } }),
      card({ tintTopLeft: 0xff0000 }),
      card({ visible: false }),
    ]) {
      expect(signature([scene([changed])])).not.toBe(still);
    }
    expect(signature([scene([card()], { cameras: [{ ...camera, scrollY: 4 }] })])).not.toBe(still);
  });

  test("a child moving inside a container, or a Graphics redrawn, signs differently", () => {
    const box = (y: number): SignedObject => ({ type: "Container", x: 0, y: 0, list: [card({ y })] });
    expect(signature([scene([box(20)])])).not.toBe(signature([scene([box(21)])]));
    const panel = (width: number): SignedObject => ({
      type: "Graphics",
      commandBuffer: [7, 0xffffff, 1, 3, 0, 0, width, 40],
    });
    expect(signature([scene([panel(100)])])).not.toBe(signature([scene([panel(120)])]));
  });

  test("a scrolling list's clip rectangle is part of the picture", () => {
    const clipped = (top: number): SignedObject => ({
      type: "Container",
      list: [],
      mask: { maskGameObject: { type: "Graphics", commandBuffer: [7, 0xffffff, 1, 3, 0, top, 360, 200] } },
    });
    expect(signature([scene([clipped(100)])])).not.toBe(signature([scene([clipped(110)])]));
  });

  test("what's hidden doesn't count, and a hidden scene's objects don't either", () => {
    const hidden = (x: number): SignedObject => card({ visible: false, x });
    expect(signature([scene([hidden(1)])])).toBe(signature([scene([hidden(2)])]));
    expect(signature([scene([card({ x: 1 })], { visible: false })])).toBe(
      signature([scene([card({ x: 2 })], { visible: false })]),
    );
  });

  test("a camera effect, a video or a label with text still to paint always draws", () => {
    expect(signature([scene([], { cameras: [{ ...camera, fadeEffect: { isRunning: true } }] })])).toBeNull();
    expect(signature([scene([{ type: "Video" }])])).toBeNull();
    expect(signature([scene([{ type: "Text", lazyDirty: true }])])).toBeNull();
  });

  test("a label waiting on the text worker draws again when its bitmap is in", () => {
    expect(signature([scene([{ type: "Text", workerJob: 4 }])])).not.toBe(signature([scene([{ type: "Text" }])]));
  });
});
