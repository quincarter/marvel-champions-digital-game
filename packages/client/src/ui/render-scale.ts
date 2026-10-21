/**
 * Draws the game at more device pixels than CSS pixels: a phone's own resolution (#320).
 *
 * The game runs in Phaser's RESIZE mode, where the canvas is its parent's size in CSS pixels (`main.ts`), and Phaser 4
 * has no renderer resolution of its own. On a 3x phone (360 x 788 CSS pixels, 1080 x 2364 on the glass) the game drew
 * 360 x 788 pixels and the browser stretched them three times over, so every edge and every picture came out soft.
 *
 * This layer sits under Phaser, at the WebGL context, so nothing above it changes: scenes still lay out in CSS pixels,
 * `scale.gameSize` and every pointer coordinate stay what they were, and the projection still maps CSS pixels to the
 * screen. Only the pixels behind them change:
 *  - the canvas's drawing buffer is `scale` times its CSS size (`ScaleManager#updateScale` is wrapped to size it);
 *  - every `gl.viewport` and `gl.scissor` box is multiplied by `scale`, so the CSS-pixel projection fills the larger
 *    buffer and a scissor (a camera, a mask's clip) lands on the same place;
 *  - every render target (`texImage2D` with no pixels, and its stencil `renderbufferStorage`) is allocated `scale`
 *    times larger, so a masked list or a filtered camera draws as sharp as the rest of the table;
 *  - `drawingBufferWidth` / `drawingBufferHeight` report the CSS size the renderer works in.
 * Texture uploads with pixels (card art, text) are untouched: they were always sampled at whatever size they draw.
 *
 * WebGL in RESIZE mode only: the Canvas renderer (`?renderer=canvas`) and FIT mode (the desktop app's fixed
 * resolution, `ui/render-resolution.ts`) keep 1x. `gl.readPixels` is not scaled, and nothing in the game reads pixels
 * back.
 */
import type Phaser from "phaser";

type Gl = WebGLRenderingContext | WebGL2RenderingContext;

/** What the settings ask for (`setRenderScale`). */
let requested = 1;
/** What the game draws at now: `requested` in RESIZE mode with WebGL, capped by the GPU's limits; otherwise 1. */
let scale = 1;
let installed: Gl | null = null;
/** The canvas's CSS size, which the renderer is told is its drawing buffer's. */
let css = { width: 0, height: 0 };
/** The GPU's largest texture, renderbuffer or viewport side. */
let maxSide = Number.POSITIVE_INFINITY;
let game: Phaser.Game | null = null;

/** The multiplier the game draws at right now: device pixels per CSS pixel. */
export function currentRenderScale(): number {
  return scale;
}

/** `value` scaled to device pixels, rounded so two boxes that meet in CSS pixels still meet. */
export function scaledEdge(value: number, by: number): number {
  return Math.round(value * by);
}

/** A viewport or scissor box (x, y, width, height) in device pixels, edges rounded rather than sizes. */
export function scaledBox(
  x: number,
  y: number,
  width: number,
  height: number,
  by: number,
): readonly [number, number, number, number] {
  if (by === 1) return [x, y, width, height];
  const left = scaledEdge(x, by);
  const bottom = scaledEdge(y, by);
  return [left, bottom, scaledEdge(x + width, by) - left, scaledEdge(y + height, by) - bottom];
}

/**
 * The scale a canvas of this CSS size can draw at: `wanted`, lowered so no side of the buffer (or of a full-screen
 * render target) passes the GPU's largest texture, renderbuffer or viewport, and never under 1.
 */
export function scaleWithinGpu(wanted: number, width: number, height: number, largest: number): number {
  const longest = Math.max(width, height);
  if (wanted <= 1 || longest <= 0) return Math.max(1, wanted);
  return Math.max(1, Math.min(wanted, Math.floor((largest / longest) * 100) / 100));
}

/**
 * Wraps a WebGL context so the renderer above it works in CSS pixels while it draws in device pixels. Idempotent per
 * context. While the scale is 1 every call passes straight through.
 */
function wrapContext(gl: Gl, canvas: { readonly width: number; readonly height: number }): void {
  if (installed === gl) return;
  installed = gl;
  const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
  maxSide = Math.min(
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    dims ? Math.min(dims[0]!, dims[1]!) : Number.POSITIVE_INFINITY,
  );
  const viewport = gl.viewport.bind(gl);
  const scissor = gl.scissor.bind(gl);
  const texImage2D = gl.texImage2D.bind(gl) as (...args: unknown[]) => void;
  const renderbufferStorage = gl.renderbufferStorage.bind(gl);
  const target = gl as unknown as Record<string, unknown>;
  target["viewport"] = (x: number, y: number, width: number, height: number) =>
    viewport(...scaledBox(x, y, width, height, scale));
  target["scissor"] = (x: number, y: number, width: number, height: number) =>
    scissor(...scaledBox(x, y, width, height, scale));
  target["texImage2D"] = (...args: unknown[]) => {
    // (target, level, internalFormat, width, height, border, format, type, null): an empty render target.
    if (scale !== 1 && args.length === 9 && args[8] === null) {
      args[3] = Math.max(1, Math.round((args[3] as number) * scale));
      args[4] = Math.max(1, Math.round((args[4] as number) * scale));
    }
    return texImage2D(...args);
  };
  target["renderbufferStorage"] = (kind: number, format: number, width: number, height: number) =>
    renderbufferStorage(kind, format, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  // The renderer computes the canvas's scissor box from these (`WebGLRenderer#resize`); it works in CSS pixels.
  Object.defineProperty(gl, "drawingBufferWidth", {
    configurable: true,
    get: () => (scale === 1 ? canvas.width : css.width),
  });
  Object.defineProperty(gl, "drawingBufferHeight", {
    configurable: true,
    get: () => (scale === 1 ? canvas.height : css.height),
  });
}

type ScaleManagerInternals = Phaser.Scale.ScaleManager & { updateScale(): void; scaleMode: number };

interface RenderTargetTexture {
  readonly drawingContext?: {
    readonly width: number;
    readonly height: number;
    readonly useCanvas?: boolean;
    readonly framebuffer?: { resize(width: number, height: number): void } | null;
  };
}

interface GlStateCache {
  viewport?: number[];
  scissor?: { box?: number[] };
}

/**
 * After the scale changes, every render target allocated at the old scale is allocated again at the new one. Pooled
 * contexts are dropped; a DynamicTexture (each mask keeps one, `Filters.Mask`) resizes its framebuffer in place, and
 * the mask draws into it again on its next update. The GL state cache still holds the last viewport and scissor in CSS
 * pixels, which have not changed, so it forgets them and the next frame sets them again at the new scale.
 */
function reallocateRenderTargets(target: Phaser.Game): void {
  const renderer = target.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
  if (renderer === undefined || installed === null) return;
  renderer.drawingContextPool?.clear();
  const textures = (target.textures as unknown as { list?: Record<string, RenderTargetTexture> } | undefined)?.list;
  for (const texture of Object.values(textures ?? {})) {
    const context = texture.drawingContext;
    if (context?.framebuffer && !context.useCanvas) context.framebuffer.resize(context.width, context.height);
  }
  const cache = (renderer as unknown as { glWrapper?: { state?: GlStateCache } }).glWrapper?.state;
  if (cache?.viewport) cache.viewport = [-1, -1, -1, -1];
  if (cache?.scissor?.box) cache.scissor.box = [-1, -1, -1, -1];
}

/**
 * Makes the canvas's drawing buffer follow the render scale: after Phaser sizes the canvas in RESIZE mode, the buffer
 * becomes `scale` times that and the canvas keeps its CSS size.
 */
function wrapScaleManager(target: Phaser.Game, resizeMode: number, restorePrototype: () => void): void {
  const manager = target.scale as ScaleManagerInternals;
  const updateScale = manager.updateScale.bind(manager);
  manager.updateScale = () => {
    updateScale();
    // The scale manager boots after the renderer: the context is wrapped by now, or never will be.
    restorePrototype();
    const canvas = manager.canvas;
    const resize = manager.scaleMode === resizeMode;
    const width = manager.gameSize.width;
    const height = manager.gameSize.height;
    const next = installed === null || !resize ? 1 : scaleWithinGpu(requested, width, height, maxSide);
    if (resize) {
      css = { width, height };
      canvas.style.width = next === 1 ? "" : `${width}px`;
      canvas.style.height = next === 1 ? "" : `${height}px`;
      if (next !== 1) {
        canvas.width = scaledEdge(width, next);
        canvas.height = scaledEdge(height, next);
      }
    }
    if (next !== scale) {
      scale = next;
      reallocateRenderTargets(target);
    }
  };
}

/**
 * Hooks the game's WebGL context and scale manager. Call from the game config's `preBoot`, before the renderer asks
 * the canvas for its context: the context is wrapped as it is created. `resizeMode` is `Phaser.Scale.RESIZE`, passed
 * in so this module never loads Phaser itself (its tests run without a window).
 */
export function installRenderScale(target: Phaser.Game, initial: number, resizeMode: number): void {
  game = target;
  requested = Math.max(1, initial);
  const canvasProto = HTMLCanvasElement.prototype;
  const getContext = canvasProto.getContext;
  const restorePrototype = (): void => {
    if (canvasProto.getContext !== getContext) canvasProto.getContext = getContext;
  };
  // Only the next WebGL context the renderer creates, then the prototype is put back.
  canvasProto.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown) {
    const context = (getContext as (k: string, o?: unknown) => RenderingContext | null).call(this, kind, options);
    if (context !== null && (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl")) {
      restorePrototype();
      wrapContext(context as Gl, this);
    }
    return context;
  } as typeof getContext;
  wrapScaleManager(target, resizeMode, restorePrototype);
  // In case the scale manager never ran after the renderer (a renderer that failed to start).
  target.events.once("ready", restorePrototype);
}

/** Changes the render scale on a running game: the canvas, every render target, and the next frame. */
export function setRenderScale(next: number): void {
  requested = Math.max(1, next);
  if (game === null) return;
  const manager = game.scale as ScaleManagerInternals;
  const before = scale;
  manager.updateScale();
  if (scale !== before) game.renderer?.resize?.(manager.gameSize.width, manager.gameSize.height);
}
