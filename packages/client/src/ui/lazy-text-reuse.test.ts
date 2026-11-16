/**
 * A label the text worker painted is kept (`label-bitmap-cache.ts`) and reused when a redraw makes the same label
 * again, so its pixels are uploaded to a second texture from the same canvas. On some Windows players' GPUs a
 * `bitmaprenderer` canvas uploaded blank that second time, and every reused label drew nothing (#744). This walks
 * the real path, worker result → cache → a second label's `flush` → `applyCanvas`, over a fake canvas that behaves
 * like that GPU, and checks both labels get the painted pixels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A canvas whose "pixels" are what was last drawn into it, read by each upload. */
interface FakeCanvas {
  width: number;
  height: number;
  kind: "2d" | "bitmaprenderer" | null;
  pixels: string | null;
  uploads: number;
  getContext(kind: string): unknown;
}

function fakeCanvas(): FakeCanvas {
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    kind: null,
    pixels: null,
    uploads: 0,
    getContext(kind: string) {
      if (kind === "bitmaprenderer") {
        canvas.kind = "bitmaprenderer";
        return { transferFromImageBitmap: (bitmap: { pixels: string }) => (canvas.pixels = bitmap.pixels) };
      }
      canvas.kind = "2d";
      return {
        drawImage: (source: { pixels: string }) => (canvas.pixels = source.pixels),
        measureText: (text: string) => ({ width: text.length * 8 }),
      };
    },
  };
  return canvas;
}

/** The GPU in the report: a `bitmaprenderer` canvas uploads its pixels once, then blank. */
function upload(canvas: FakeCanvas): string | null {
  canvas.uploads++;
  if (canvas.kind === "bitmaprenderer" && canvas.uploads > 1) return null;
  return canvas.pixels;
}

/** What each label's texture was last given. */
const textures = new Map<object, string | null>();
/** The jobs the fake text worker was handed, waiting for `finishJobs`. */
let jobs: { target: { applyBitmap: (...args: never[]) => void }; frame: { width: number; height: number } }[] = [];

vi.mock("../art/card-face-baker.js", () => ({ pageFontSources: () => [] }));
vi.mock("./font-metrics.js", () => ({ documentFontReady: () => true, installFontMetricsCache: () => undefined }));
vi.mock("./text-layout.js", () => ({
  WidthCache: class {
    widthOf(_font: string, _text: string, measure: () => number) {
      return measure();
    }
  },
  workerCanPaint: () => true,
  layoutText: (input: { lines: string[] }, widthOf: (text: string) => number) => {
    const width = Math.max(...input.lines.map(widthOf));
    return {
      width,
      height: 20,
      canvasWidth: width,
      canvasHeight: 20,
      lines: input.lines.map((text, i) => ({ text, x: 0, y: 16 + i * 20 })),
    };
  },
}));
vi.mock("./text-painter.js", () => ({
  TextPainter: class {
    #next = 1;
    wants() {
      return true;
    }
    submit(
      target: (typeof jobs)[number]["target"],
      _old: unknown,
      _job: unknown,
      frame: (typeof jobs)[number]["frame"],
    ) {
      jobs.push({ target, frame });
      return this.#next++;
    }
    forget() {}
  },
}));

// Just enough of Phaser's `Text` for `McLazyText`: the base constructor sets the text and calls `updateText`.
vi.mock("phaser", () => {
  class Text {
    _text: string;
    style: Record<string, unknown>;
    canvas = fakeCanvas();
    context = this.canvas.getContext("2d");
    padding = { left: 0, right: 0, top: 0, bottom: 0 };
    letterSpacing = 0;
    lineSpacing = 0;
    splitRegExp = /\n/;
    autoRound = true;
    input = null;
    renderer = {
      gl: {},
      canvasToTexture: (canvas: FakeCanvas, texture: object) => {
        textures.set(texture, upload(canvas));
        return texture;
      },
    };
    frame = {
      setSize: () => undefined,
      updateUVs: () => undefined,
      source: { glTexture: {}, resolution: 1, updateSize: () => undefined },
    };
    constructor(
      readonly scene: unknown,
      _x: number,
      _y: number,
      text: string,
      style: Record<string, unknown>,
    ) {
      this._text = text;
      this.style = {
        color: "#000000",
        stroke: "#fff",
        strokeThickness: 0,
        resolution: 1,
        _font: "16px Public Sans",
        metrics: { ascent: 16, descent: 4, fontSize: 20 },
        syncFont: () => undefined,
        ...style,
      };
      this.updateText();
    }
    updateText(): this {
      return this;
    }
    updateDisplayOrigin(): this {
      return this;
    }
    runWordWrap(text: string): string {
      return text;
    }
    preDestroy(): void {}
  }
  return { default: { GameObjects: { Text } } };
});

import { McLazyText } from "./lazy-text.js";

/** A scene in its first frames, so `flush` hands the paint to the worker. */
const scene = { sys: { game: { loop: { frame: 0 } } }, events: { once: () => undefined } };

/** The worker answers every job with a bitmap holding `pixels`. */
function finishJobs(pixels: string): void {
  const done = jobs;
  jobs = [];
  for (const { target, frame } of done) {
    const bitmap = { width: frame.width, height: frame.height, pixels, close: () => undefined };
    (target.applyBitmap as (...args: unknown[]) => void)(bitmap, frame.width, frame.height, 1);
  }
}

function label(text: string): McLazyText {
  return new McLazyText(scene as never, 0, 0, text, {});
}

const textureOf = (made: McLazyText): string | null | undefined =>
  textures.get((made as unknown as { frame: { source: { glTexture: object } } }).frame.source.glTexture);

beforeEach(() => {
  textures.clear();
  jobs = [];
  vi.stubGlobal("Worker", class {});
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
});

afterEach(() => vi.unstubAllGlobals());

describe("a label reused from the paint cache (#744)", () => {
  it("uploads the worker's pixels again when a redraw makes the same label", () => {
    const first = label("Settings");
    first.flush();
    expect(jobs).toHaveLength(1);
    finishJobs("pixels of Settings");
    expect(textureOf(first)).toBe("pixels of Settings");

    // The screen redraws (the Title after the Mod Store, Settings after a change): the same label, from the cache.
    first.preDestroy();
    const again = label("Settings");
    again.flush();
    expect(jobs).toHaveLength(0);
    expect(textureOf(again)).toBe("pixels of Settings");

    // And again, for the redraw after that.
    const third = label("Settings");
    third.flush();
    expect(textureOf(third)).toBe("pixels of Settings");
  });

  it("gives every label waiting on one shared paint the same pixels", () => {
    const one = label("LOCKED");
    const two = label("LOCKED");
    one.flush();
    two.flush();
    expect(jobs).toHaveLength(1);
    finishJobs("pixels of LOCKED");
    expect(textureOf(one)).toBe("pixels of LOCKED");
    expect(textureOf(two)).toBe("pixels of LOCKED");
  });
});
