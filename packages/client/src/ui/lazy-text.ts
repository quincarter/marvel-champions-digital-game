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
 * Painted labels are kept (`label-bitmap-cache.ts`): a redraw that makes a label again with the same text, style and
 * size reuses its pixels at once instead of painting it again, and labels waiting on the worker for the same pixels
 * share one job. A screen held on the void before its entrance (`holdLabelsOnMain`, from `fadeScreenIn`) paints
 * here, where a long frame is not seen, so it fades in whole.
 *
 * Installed by replacing the `text` factory (`installLazyText`), so every
 * `scene.add.text(...)` in the app gets it without naming it. A `Text` built
 * with `new` directly is untouched.
 */

import Phaser from "phaser";
import { reusableCanvasOf } from "../art/bitmap-canvas.js";
import { pageFontSources } from "../art/card-face-baker.js";
import { documentFontReady, installFontMetricsCache } from "./font-metrics.js";
import { layoutText, WidthCache, workerCanPaint, type LayoutInput } from "./text-layout.js";
import { TextPainter, type PaintTarget, type PainterDeps } from "./text-painter.js";
import type { PaintJob } from "./text-paint-protocol.js";
import { LabelBitmapCache, labelKeyOf } from "./label-bitmap-cache.js";
import { WorkerCrashGuard } from "../platform/worker-crash-guard.js";

/** The faces the text worker is given: the ones `main.ts` bundles. A label in any other family is painted here. */
const WORKER_FAMILIES: ReadonlySet<string> = new Set(["Bangers", "Public Sans", "IBM Plex Mono"]);

/**
 * Only a screen's first frames use the worker: it fades in from the void, so a label that draws a frame or two late
 * is hidden, whereas the Board redraws whole on every store update and would flicker. Counted in game frames, not
 * milliseconds, so a long build on a slow device still counts as one moment. The one other use is `paintScrolledIn`.
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
  guard: new WorkerCrashGuard("text-paint"),
};

let painter: TextPainter | null = null;
/** Labels already painted, by everything their pixels depend on (`label-bitmap-cache.ts`). */
const painted = new LabelBitmapCache();

/** A label laid out and ready to paint: its job, its frame size and its cache key (null when it must not be kept). */
interface PlannedPaint {
  readonly job: Omit<PaintJob, "id">;
  readonly frame: { readonly width: number; readonly height: number };
  readonly key: string | null;
}
/** Above zero while `paintScrolledIn` runs. */
let scrolledInDepth = 0;

/**
 * Every label `draw` makes goes to the text worker, however old the screen is. For a list row being drawn because it
 * scrolled into reach (`ui/virtual-list.ts`): it starts in the overscan, out of sight, and painting its labels here
 * was what made a slow tablet stutter under the finger, a row at a time (#631). A list redrawing its rows in place
 * doesn't use this: those are on screen, and would blink.
 */
export function paintScrolledIn<T>(draw: () => T): T {
  scrolledInDepth++;
  try {
    return draw();
  } finally {
    scrolledInDepth--;
  }
}

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

/** Screens held on the void before their entrance (`fadeScreenIn`): see `holdLabelsOnMain`. */
const heldScenes = new WeakSet<Phaser.Scene>();

/**
 * While `scene` is held on the void, waiting to fade in, its labels are painted here rather than in the worker: the
 * screen shows nothing yet, so a long frame there is not seen, and every label is ready in that one frame instead of
 * arriving over the next several. False when the screen fades in.
 */
export function holdLabelsOnMain(scene: Phaser.Scene, held: boolean): void {
  if (!held) {
    heldScenes.delete(scene);
    return;
  }
  heldScenes.add(scene);
  // The screen's first draw ran before it was held: what it measured then went to the worker. Paint those here too.
  const visit = (objects: readonly Phaser.GameObjects.GameObject[]): void => {
    for (const object of objects) {
      if (object instanceof McLazyText) {
        if (object.shared) object.repaintHere();
      } else {
        const inner = (object as { list?: unknown }).list;
        if (Array.isArray(inner)) visit(inner as Phaser.GameObjects.GameObject[]);
      }
    }
  };
  visit(scene.children.list);
}

/** How many labels are waiting on the text worker: while any are, some text on screen is not drawn yet. */
export function labelsWaitingForPaint(): number {
  return awaited.size;
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

export class McLazyText extends Phaser.GameObjects.Text {
  // `declare`, never initialized: the base constructor already calls `updateText`, and a field initializer would
  // run after it and wipe the flag it set.
  declare private lazyDirty: boolean | undefined;
  /** The id of the worker job this label is waiting on; it draws nothing until that bitmap is in. */
  declare workerJob: number | undefined;
  /** The label's texture holds a worker bitmap rather than its own canvas. */
  declare private workerPainted: boolean | undefined;
  /** Made inside `paintScrolledIn`: the worker paints it even after the screen's first frames. */
  declare private scrolledIn: boolean | undefined;
  /** The worker paint this label waits on, shared with every other label waiting on the same pixels. */
  declare shared: SharedPaint | undefined;

  override updateText(): this {
    this.lazyDirty = true;
    if (scrolledInDepth > 0) this.scrolledIn = true;
    return this;
  }

  /** Paints the canvas if anything changed since the last paint. */
  flush(): void {
    if (!this.lazyDirty) return;
    this.lazyDirty = false;
    const plan = this.planPaint();
    if (plan) {
      const known = plan.key === null ? undefined : painted.get(plan.key);
      if (known) {
        // The same label was painted before (a redraw making it again): reuse those pixels, at once.
        this.leaveShared();
        this.applyCanvas(known.canvas, known.canvasWidth, known.canvasHeight, known.resolution);
        return;
      }
      if (this.paintInWorker(plan)) return;
    }
    this.paintOnMain();
    if (plan?.key) this.rememberMainPaint(plan.key, plan);
  }

  /** Keeps a copy of what Phaser just painted, when it is the canvas `plan` describes. */
  private rememberMainPaint(key: string, plan: PlannedPaint): void {
    const own = this.canvas;
    if (own.width !== plan.job.width || own.height !== plan.job.height) return;
    const copy = document.createElement("canvas");
    copy.width = own.width;
    copy.height = own.height;
    const context = copy.getContext("2d");
    if (!context) return;
    context.drawImage(own, 0, 0);
    painted.set(key, {
      canvas: copy,
      canvasWidth: plan.frame.width,
      canvasHeight: plan.frame.height,
      resolution: plan.job.resolution,
    });
  }

  /** Stops waiting on the worker and paints now, the way `flush` would in a held screen. */
  repaintHere(): void {
    this.leaveShared();
    this.lazyDirty = true;
    this.flush();
  }

  /** Phaser's own paint: measure, size the canvas, draw, upload. */
  paintOnMain(): void {
    this.leaveShared();
    // The label's frame and texture were last sized for a worker bitmap, not for this canvas: make `updateText` see
    // a size change so it resizes both.
    if (this.workerPainted) {
      this.workerPainted = false;
      this.canvas.width = 0;
    }
    super.updateText();
  }

  override preDestroy(): void {
    this.leaveShared(true);
    super.preDestroy();
  }

  /**
   * Stops waiting on the worker. The job is dropped once no label waits on it, unless the label is being destroyed
   * (`keep`): a redraw is usually about to make the same label again, which then joins the job instead of starting
   * another, and its pixels are kept for later. A label laid out again (a new text, a font size being fitted) does
   * not want its old pixels.
   */
  leaveShared(keep = false): void {
    this.shared?.leave(this, keep);
    this.shared = undefined;
    this.workerJob = undefined;
  }

  /**
   * Puts painted pixels that are not this label's own canvas into its texture (a worker bitmap, a cached paint),
   * sizing the frame as `updateText` does for its own canvas.
   */
  applyCanvas(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number, resolution: number): void {
    this.shared = undefined;
    this.workerJob = undefined;
    this.workerPainted = true;
    this.frame.setSize(canvasWidth, canvasHeight);
    this.frame.source.updateSize(canvasWidth, canvasHeight);
    this.frame.source.resolution = resolution;
    this.frame.updateUVs();
    const source = this.frame.source;
    source.glTexture = (this.renderer as unknown as GlRenderer).canvasToTexture(canvas, source.glTexture, true);
  }

  /**
   * Lays the label out here (its size must be known now) and describes its painting as a worker job, which is also
   * its cache key. Null when only Phaser can paint this label (a style the worker can't reproduce, no WebGL).
   */
  private planPaint(): PlannedPaint | null {
    const style = this.style;
    if (!(this.renderer as { gl?: unknown } | undefined)?.gl) return null;
    if (typeof style.color !== "string" || typeof style.stroke !== "string") return null;
    if (!workerCanPaint(style, WORKER_FAMILIES)) return null;

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
    // A label painted before its font finished loading has the fallback's pixels: never kept.
    const fontReady = layout.lines.every((line) => documentFontReady(font, line.text || " "));
    return {
      job,
      frame: { width: layout.canvasWidth, height: layout.canvasHeight },
      key: fontReady ? labelKeyOf(job) : null,
    };
  }

  /** Queues `plan` for the worker. False when this label should be painted by Phaser instead. */
  private paintInWorker(plan: PlannedPaint): boolean {
    const worker = textPainter();
    if (!worker) return false;
    // A held screen paints everything here, rows drawn ahead in a list's overscan included (`holdLabelsOnMain`).
    if (heldScenes.has(this.scene)) return false;
    if (!this.scrolledIn && !sceneIsYoung(this.scene)) return false;
    if (!worker.wants()) return false;
    this.leaveShared();
    // The same pixels already on their way (another "LOCKED" chip, or this label as the last redraw made it): wait
    // on that job rather than painting them twice.
    let shared = plan.key === null ? undefined : inFlight.get(plan.key);
    if (!shared) {
      shared = new SharedPaint(plan.key);
      shared.id = worker.submit(shared, undefined, plan.job, plan.frame);
      if (plan.key !== null) inFlight.set(plan.key, shared);
    }
    shared.join(this);
    this.shared = shared;
    this.workerJob = shared.id;
    return true;
  }
}

/** Worker paints on their way, by cache key. */
const inFlight = new Map<string, SharedPaint>();
/** Worker paints some label is waiting on: not those kept on only for the cache after their labels went. */
const awaited = new Set<SharedPaint>();

/** One worker job and the labels waiting on its pixels: the painter's target, on behalf of them all. */
class SharedPaint implements PaintTarget {
  id = 0;
  readonly #key: string | null;
  readonly #labels = new Set<McLazyText>();
  /** Every label waiting on it was destroyed; it is still painted, for the cache and for a label made again. */
  #orphaned = false;

  constructor(key: string | null) {
    this.#key = key;
  }

  /** Wanted while a label waits on it, or (its last label destroyed) while its pixels can be kept for the next redraw. */
  get active(): boolean {
    return this.#labels.size > 0 || this.#orphaned;
  }

  join(label: McLazyText): void {
    this.#orphaned = false;
    this.#labels.add(label);
    awaited.add(this);
  }

  leave(label: McLazyText, keep: boolean): void {
    this.#labels.delete(label);
    if (this.#labels.size > 0) return;
    awaited.delete(this);
    if (keep && this.#key !== null) {
      this.#orphaned = true;
      return;
    }
    this.#orphaned = false;
    textPainter()?.forget(this.id);
    this.#done();
  }

  applyBitmap(bitmap: ImageBitmap, canvasWidth: number, canvasHeight: number, resolution: number): void {
    this.#done();
    // Kept and shared, so uploaded more than once: never a `bitmaprenderer` canvas (`reusableCanvasOf`).
    const canvas = reusableCanvasOf(bitmap);
    if (this.#key !== null) painted.set(this.#key, { canvas, canvasWidth, canvasHeight, resolution });
    for (const label of this.#take()) label.applyCanvas(canvas, canvasWidth, canvasHeight, resolution);
  }

  paintOnMain(): void {
    this.#done();
    for (const label of this.#take()) label.paintOnMain();
  }

  /** No later label joins this job. */
  #done(): void {
    if (this.#key !== null && inFlight.get(this.#key) === this) inFlight.delete(this.#key);
  }

  /** The labels still waiting on this job, which stop waiting on it. */
  #take(): McLazyText[] {
    const labels = [...this.#labels].filter((label) => label.shared === this);
    this.#labels.clear();
    awaited.delete(this);
    for (const label of labels) label.shared = undefined;
    return labels;
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
