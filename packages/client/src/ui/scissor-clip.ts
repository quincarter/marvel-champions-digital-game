/**
 * Clips a masked object to a plain rectangle with the GPU's scissor test instead of Phaser 4's Mask filter (#328).
 *
 * Every scrolling list, the hand and the zone strips clip their content with `setMask` (`ui/rex.ts`), and under WebGL
 * that is a Mask filter: each frame the object draws into a render target the size of the whole screen, the mask
 * shape draws into another, and a third pass blends them back. At 1x on a 360 x 788 phone that was cheap; drawing at
 * the screen's own density (#320, `ui/render-scale.ts`) made each of those passes nine times larger, and a 3x phone at
 * 120 Hz spent its memory bandwidth on them: scrolling a menu or the hand ran about a second behind the finger, and
 * the rest of the phone slowed with it.
 *
 * Nearly every one of those masks is a single axis-aligned rectangle, which the scissor test clips for free. So a
 * render step runs ahead of the object's filters: when its mask is a Graphics holding one `fillRect` with no rotation,
 * and the object draws straight through a scene camera that neither zooms, rotates nor scrolls, the Mask filter is
 * switched off for the frame and the object draws into a copy of the drawing context whose scissor box is that
 * rectangle (cut down to any scissor already in force, so clips nest). Anything else (a circle, a jagged edge, an
 * inverted mask, a camera that zooms, an object drawn inside another object's filter) keeps the Mask filter, so it
 * still looks exactly as it did.
 */
import type Phaser from "phaser";
import { currentRenderScale } from "./render-scale.js";

export interface ClipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Phaser's Graphics command codes (`gameobjects/graphics/Commands.js`) the rectangle check reads. */
const FILL_RECT = 3;
const LINE_STYLE = 6;
const FILL_STYLE = 7;

/**
 * The one rectangle a Graphics command buffer fills, or null when it draws anything else (a second rectangle, a
 * circle, a path, a stroke, a transform). Style changes draw nothing: `make.graphics` starts every buffer with its
 * default line and fill style.
 */
export function singleFillRect(commands: readonly unknown[]): ClipRect | null {
  let rect: ClipRect | null = null;
  let index = 0;
  while (index < commands.length) {
    const command = commands[index];
    if (command === LINE_STYLE) {
      index += 4;
    } else if (command === FILL_STYLE) {
      index += 3;
    } else if (command === FILL_RECT && rect === null) {
      const [x, y, width, height] = commands.slice(index + 1, index + 5) as number[];
      if (![x, y, width, height].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
      rect = { x: x!, y: y!, width: width!, height: height! };
      index += 5;
    } else {
      return null;
    }
  }
  return rect;
}

/** A transform matrix's six values, as Phaser's `TransformMatrix` holds them. */
export interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

/** `rect` through `matrix`, or null when the matrix rotates or skews it off the axes. */
export function transformedRect(rect: ClipRect, matrix: Affine): ClipRect | null {
  if (matrix.b !== 0 || matrix.c !== 0) return null;
  const x1 = matrix.a * rect.x + matrix.tx;
  const x2 = matrix.a * (rect.x + rect.width) + matrix.tx;
  const y1 = matrix.d * rect.y + matrix.ty;
  const y2 = matrix.d * (rect.y + rect.height) + matrix.ty;
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/** Where two rectangles overlap; zero-sized when they don't. */
export function intersectRects(a: ClipRect, b: ClipRect): ClipRect {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** `rect`'s edges moved onto the device-pixel grid at `scale`, so a clip lands where a mask's edge used to. */
export function snapRect(rect: ClipRect, scale: number): ClipRect {
  const snap = (value: number): number => Math.round(value * scale) / scale;
  const left = snap(rect.x);
  const top = snap(rect.y);
  return { x: left, y: top, width: snap(rect.x + rect.width) - left, height: snap(rect.y + rect.height) - top };
}

/**
 * A scissor box as a drawing context stores it (GL's bottom-left origin) turned back into a top-left rectangle in a
 * context `height` tall.
 */
export function topLeftOfScissor(box: readonly number[], height: number): ClipRect {
  const [x = 0, y = 0, width = 0, height_ = 0] = box;
  return { x, y: height - y - height_, width, height: height_ };
}

type Context = Phaser.Renderer.WebGL.DrawingContext;
type Renderer = Phaser.Renderer.WebGL.WebGLRenderer;
type Camera = Phaser.Cameras.Scene2D.BaseCamera & { readonly isObjectInversion?: boolean; readonly rotation?: number };
type Masked = Phaser.GameObjects.GameObject & {
  mask?: { active: boolean; invert?: boolean; maskGameObject?: Phaser.GameObjects.GameObject | null } | null;
  addRenderStep?: (fn: RenderStep, index?: number) => unknown;
  renderWebGLStep: (...args: Parameters<RenderStep>) => void;
  _renderSteps?: RenderStep[] | null;
};
type RenderStep = (
  renderer: Renderer,
  gameObject: Masked,
  drawingContext: Context,
  parentMatrix: unknown,
  renderStep: number,
  displayList?: unknown,
  displayListIndex?: number,
) => void;

/**
 * The scissor rectangle for `gameObject` in `context`'s own top-left coordinates, or null when the Mask filter has to
 * do the clipping.
 */
function scissorFor(gameObject: Masked, context: Context): ClipRect | null {
  const mask = gameObject.mask;
  const shape = mask?.maskGameObject as
    | (Phaser.GameObjects.Graphics & { commandBuffer?: unknown[]; getWorldTransformMatrix?: () => Affine })
    | null
    | undefined;
  if (!mask || mask.invert || !shape || shape.type !== "Graphics" || !shape.commandBuffer) return null;
  const local = singleFillRect(shape.commandBuffer);
  if (local === null || !shape.getWorldTransformMatrix) return null;
  const world = transformedRect(local, shape.getWorldTransformMatrix());
  const camera = context.camera as Camera | null;
  if (world === null || camera === null || camera.isObjectInversion) return null;
  if (camera.zoom !== 1 || (camera.rotation ?? 0) !== 0 || camera.scrollX !== 0 || camera.scrollY !== 0) return null;
  // Straight onto the canvas the camera sits at its own place; into the camera's own render target, at the origin.
  const onCanvas = (context.state as { bindings?: { framebuffer?: unknown } }).bindings?.framebuffer == null;
  const offsetX = onCanvas ? camera.x : 0;
  const offsetY = onCanvas ? camera.y : 0;
  let rect: ClipRect = { ...world, x: world.x + offsetX, y: world.y + offsetY };
  const scissor = context.state.scissor as { box: number[]; enable: boolean };
  if (scissor.enable) rect = intersectRects(rect, topLeftOfScissor(scissor.box, context.height));
  return snapRect(rect, currentRenderScale());
}

const clipStep: RenderStep = (renderer, gameObject, context, parentMatrix, renderStep, displayList, index) => {
  const mask = gameObject.mask;
  const rect = mask ? scissorFor(gameObject, context) : null;
  if (mask) mask.active = rect === null;
  if (rect === null) {
    gameObject.renderWebGLStep(renderer, gameObject, context, parentMatrix, renderStep + 1, displayList, index);
    return;
  }
  if (rect.width <= 0 || rect.height <= 0) return;
  const clipped = context.getClone();
  clipped.setScissorEnable(true);
  clipped.setScissorBox(rect.x, rect.y, rect.width, rect.height);
  // `use` ends the batch drawn so far under the old box; the second end draws this object's batch under the new one.
  clipped.use();
  gameObject.renderWebGLStep(renderer, gameObject, clipped, parentMatrix, renderStep + 1, displayList, index);
  renderer.renderNodes.finishBatch();
};

/** Runs the scissor check ahead of `gameObject`'s Mask filter. Idempotent; WebGL only (Canvas has no render steps). */
export function addScissorClip(gameObject: Phaser.GameObjects.GameObject): void {
  const target = gameObject as Masked;
  if (!target.addRenderStep || target._renderSteps?.includes(clipStep)) return;
  target.addRenderStep(clipStep, 0);
}

/** Takes the scissor check off again, with the mask. */
export function removeScissorClip(gameObject: Phaser.GameObjects.GameObject): void {
  const steps = (gameObject as Masked)._renderSteps;
  const at = steps?.indexOf(clipStep) ?? -1;
  if (at >= 0) steps!.splice(at, 1);
}
