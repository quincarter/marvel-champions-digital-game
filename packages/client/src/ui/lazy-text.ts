/**
 * A `Text` that rasterizes once, when something needs the result, instead of
 * once per setter.
 *
 * Phaser's `Text` redraws its whole 2D canvas and re-uploads its texture inside
 * every call that could change how it looks: the constructor's `setText`, then
 * again for a style's `padding`, again for its `letterSpacing`, and again for
 * each `setPadding` / `setBackgroundColor` / `setFontSize` / `setWordWrapWidth`
 * chained after it. Measured on the phone board (2026-09-21): about 40 labels,
 * about 100 rasterizations, and four fifths of a redraw's time — and every
 * screen here redraws whole on every change, so that is what a tap waits for.
 *
 * Nothing between those calls looks at the result, so they only have to mark
 * the label dirty. The work happens the first time anyone reads the label's
 * size (layout, `fitText`, `setOrigin`'s display origin, a sizer) or draws it.
 * What a caller observes is unchanged; how often the canvas is painted is not.
 *
 * The same deferral is where text can leave the main thread. Layout (size, line positions) stays here and is
 * computed from cached font metrics and line widths (`font-metrics.ts`, `text-layout.ts`); only the painting goes to
 * the text-paint worker (`text-painter.ts`), and only in a screen's first frames (`WORKER_YOUTH_FRAMES`), when
 * the fade-in hides a label that draws a frame late. A label the worker can't paint exactly (`workerCanPaint`), a
 * Canvas renderer, a missing worker or a worker that fails all take the main-thread path below.
 *
 * Installed by replacing the `text` factory (`installLazyText`), so every
 * `scene.add.text(...)` in the app gets it without naming it. A `Text` built
 * with `new` directly is untouched.
 */

import Phaser from "phaser";
import { canvasOf } from "../art/bitmap-canvas.js";
import { pageFontSources } from "../art/card-face-baker.js";
import { documentFontReady, installFontMetricsCache } from "./font-metrics.js";
import { layoutText, WidthCache, workerCanPaint, type LayoutInput } from "./text-layout.js";
import { TextPainter, type PaintTarget, type PainterDeps } from "./text-painter.js";
import type { PaintJob } from "./text-paint-protocol.js";

/** The faces the text worker is given: the ones `main.ts` bundles. A label in any other family is painted here. */
const WORKER_FAMILIES: ReadonlySet<string> = new Set(["Bangers", "Public Sans", "IBM Plex Mono"]);

/**
 * Only a screen's first frames use the worker: it fades in from the void, so a label that draws a frame or two late
 * is hidden, whereas the Board redraws whole on every store update and would flicker. Counted in game frames, not
 * milliseconds, so a long build on a slow device still counts as one moment.
 */
const WORKER_YOUTH_FRAMES = 40;

const widths = new WidthCache(documentFontReady);
const sceneFirstFrame = new WeakMap<Phaser.Scene, number>();

const painterDeps: PainterDeps = {
  spawn: () => {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
    if (typeof createImageBitmap === "undefined") return null;
    return new Worker(new URL("../workers/text-paint.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-text-paint",
    }) as unknown as ReturnType<PainterDeps["spawn"]>;
  },
  fonts: () => pageFontSources(WORKER_FAMILIES),
  now: () => performance.now(),
  afterTask: (fn) => queueMicrotask(fn),
  nextFrame: (fn) => requestAnimationFrame(fn),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

let painter: TextPainter | null = null;

/** The worker painter, or null where it can't exist (Vitest, and anything without workers or `OffscreenCanvas`). */
function textPainter(): TextPainter | null {
  if (painter) return painter;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof document === "undefined") {
    return null;
  }
  painter = new TextPainter(painterDeps);
  return painter;
}

/**
 * Starts the text worker ahead of a screen change (`goToScreen`), so a worker that ended while the player sat on one
 * screen has its fonts loaded again by the time the next screen's labels are measured, rather than holding them blank.
 */
export function prewarmTextPainter(): void {
  textPainter()?.wants();
}

/** True while `scene` is in its first frames (see `WORKER_YOUTH_FRAMES`). */
function sceneIsYoung(scene: Phaser.Scene | undefined): boolean {
  const loop = scene?.sys?.game?.loop;
  if (!scene || !loop) return false;
  let first = sceneFirstFrame.get(scene);
  if (first === undefined) {
    first = loop.frame;
    sceneFirstFrame.set(scene, first);
    scene.events.once("shutdown", () => sceneFirstFrame.delete(scene));
  }
  return loop.frame - first < WORKER_YOUTH_FRAMES;
}

/** Phaser members that are real but not in its typings. */
interface GlRenderer {
  canvasToTexture(
    canvas: HTMLCanvasElement,
    texture: typeof Phaser.Textures.TextureSource.prototype.glTexture,
    noRepeat: boolean,
  ): typeof Phaser.Textures.TextureSource.prototype.glTexture;
}
interface TextInternals {
  _text: string;
}
interface StyleInternals {
  _font: string;
  metrics: { ascent: number; descent: number; fontSize: number };
}

export class McLazyText extends Phaser.GameObjects.Text implements PaintTarget {
  // `declare`, never initialized: the base constructor already calls `updateText`, and a field initializer would
  // run after it and wipe the flag it set.
  declare private lazyDirty: boolean | undefined;
  /** The id of the worker job this label is waiting on; it draws nothing until that bitmap is in. */
  declare workerJob: number | undefined;
  /** The label's texture holds a worker bitmap rather than its own canvas. */
  declare private workerPainted: boolean | undefined;

  override updateText(): this {
    this.lazyDirty = true;
    return this;
  }

  /** Paints the canvas if anything changed since the last paint. */
  flush(): void {
    if (!this.lazyDirty) return;
    this.lazyDirty = false;
    if (!this.paintInWorker()) this.paintOnMain();
  }

  /** Phaser's own paint: measure, size the canvas, draw, upload. */
  paintOnMain(): void {
    textPainter()?.forget(this.workerJob);
    this.workerJob = undefined;
    // The label's frame and texture were last sized for a worker bitmap, not for this canvas: make `updateText` see
    // a size change so it resizes both.
    if (this.workerPainted) {
      this.workerPainted = false;
      this.canvas.width = 0;
    }
    super.updateText();
  }

  override preDestroy(): void {
    textPainter()?.forget(this.workerJob);
    this.workerJob = undefined;
    super.preDestroy();
  }

  /** Puts a worker bitmap in this label's texture, sizing the frame as `updateText` does for its own canvas. */
  applyBitmap(bitmap: ImageBitmap, canvasWidth: number, canvasHeight: number, resolution: number): void {
    this.workerJob = undefined;
    this.workerPainted = true;
    this.frame.setSize(canvasWidth, canvasHeight);
    this.frame.source.updateSize(canvasWidth, canvasHeight);
    this.frame.source.resolution = resolution;
    this.frame.updateUVs();
    const source = this.frame.source;
    source.glTexture = (this.renderer as unknown as GlRenderer).canvasToTexture(
      canvasOf(bitmap),
      source.glTexture,
      true,
    );
  }

  /**
   * Lays the label out here (its size must be known now) and queues the painting for the worker. False when this
   * label should be painted by Phaser instead.
   */
  private paintInWorker(): boolean {
    const worker = textPainter();
    const style = this.style;
    if (!worker || !(this.renderer as { gl?: unknown } | undefined)?.gl) return false;
    if (typeof style.color !== "string" || typeof style.stroke !== "string") return false;
    if (!workerCanPaint(style, WORKER_FAMILIES) || !sceneIsYoung(this.scene)) return false;
    if (!worker.wants()) return false;

    const context = this.context;
    const padding = this.padding;
    const font = (style as unknown as StyleInternals)._font;
    let fontSet = false;
    const widthOf = (text: string): number =>
      widths.widthOf(font, text, () => {
        if (!fontSet) {
          style.syncFont(this.canvas, context);
          fontSet = true;
        }
        return context.measureText(text).width;
      });

    let text = (this as unknown as TextInternals)._text;
    if (style.wordWrapWidth) {
      style.syncFont(this.canvas, context);
      fontSet = true;
      text = this.runWordWrap(text);
    }
    const input: LayoutInput = {
      lines: text.split(this.splitRegExp as RegExp),
      metrics: (style as unknown as StyleInternals).metrics,
      strokeThickness: style.strokeThickness,
      letterSpacing: this.letterSpacing,
      lineSpacing: this.lineSpacing,
      maxLines: style.maxLines,
      fixedWidth: style.fixedWidth,
      fixedHeight: style.fixedHeight,
      padding: {
        left: padding.left ?? 0,
        right: padding.right ?? 0,
        top: padding.top ?? 0,
        bottom: padding.bottom ?? 0,
      },
      align: style.align as LayoutInput["align"],
      resolution: style.resolution,
      autoRound: this.autoRound,
    };
    const layout = layoutText(input, widthOf);

    this.width = layout.width;
    this.height = layout.height;
    this.updateDisplayOrigin();
    const hit = this.input;
    if (hit && !hit.customHitArea) {
      hit.hitArea.width = this.width;
      hit.hitArea.height = this.height;
    }

    const job: Omit<PaintJob, "id"> = {
      width: Math.trunc(layout.canvasWidth),
      height: Math.trunc(layout.canvasHeight),
      resolution: style.resolution,
      font,
      background: style.backgroundColor || null,
      paddingLeft: padding.left ?? 0,
      paddingTop: padding.top ?? 0,
      fill: style.color,
      stroke: style.stroke,
      strokeThickness: style.strokeThickness,
      letterSpacing: this.letterSpacing,
      shadow: {
        offsetX: style.shadowOffsetX ?? 0,
        offsetY: style.shadowOffsetY ?? 0,
        color: style.shadowColor,
        blur: style.shadowBlur,
        fill: style.shadowFill,
        stroke: style.shadowStroke,
      },
      lines: layout.lines,
    };
    this.workerJob = worker.submit(this, this.workerJob, job, {
      width: layout.canvasWidth,
      height: layout.canvasHeight,
    });
    return true;
  }
}

/**
 * `width` and `height` become accessors that paint first. Defined on the prototype rather than in the class:
 * `Text` declares them as plain properties, which TypeScript will not let a subclass redeclare as accessors, and the
 * base constructor's own `this.width = …` still lands in the setter this way.
 */
function flushBeforeMeasure(size: "width" | "height", slot: "lazyWidth" | "lazyHeight"): void {
  Object.defineProperty(McLazyText.prototype, size, {
    configurable: true,
    get(this: McLazyText): number {
      this.flush();
      return (this as unknown as Record<string, number>)[slot] ?? 0;
    },
    set(this: McLazyText, value: number) {
      (this as unknown as Record<string, number>)[slot] = value;
    },
  });
}

/**
 * The renderers live on the prototype as plain functions (`TextRender`), so they are wrapped rather than overridden.
 * Phaser calls them detached, as `render(renderer, gameObject, …)`: the label is the second argument, never `this`.
 */
function flushBeforeRender(method: "renderWebGL" | "renderCanvas"): void {
  const proto = McLazyText.prototype as unknown as Record<string, (...args: unknown[]) => void>;
  const render = proto[method];
  if (!render) return;
  proto[method] = function (this: unknown, ...args: unknown[]): void {
    const label = args[1];
    if (label instanceof McLazyText) {
      label.flush();
      // Waiting on the worker: there is no texture to draw yet.
      if (label.workerJob !== undefined) return;
    }
    render.apply(this, args);
  };
}

let installed = false;

/** Makes `scene.add.text` build a `McLazyText`. Call once, before the game is created. */
export function installLazyText(): void {
  if (installed) return;
  installed = true;
  installFontMetricsCache(Phaser.GameObjects.TextStyle.prototype);
  flushBeforeMeasure("width", "lazyWidth");
  flushBeforeMeasure("height", "lazyHeight");
  flushBeforeRender("renderWebGL");
  flushBeforeRender("renderCanvas");
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (
      this: Phaser.GameObjects.GameObjectFactory,
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle,
    ) => Phaser.GameObjects.Text;
  };
  factory.text = function (x, y, text, style) {
    return this.displayList.add(new McLazyText(this.scene, x, y, text, style ?? {})) as Phaser.GameObjects.Text;
  };
}
