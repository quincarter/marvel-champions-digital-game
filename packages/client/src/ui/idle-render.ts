/**
 * Skips drawing a frame that would look exactly like the one already on screen (#328).
 *
 * Phaser draws every scene every frame, whether or not anything moved. At 1x on a 360 x 788 phone that was a small
 * picture; drawn at the screen's own density (#320, `ui/render-scale.ts`) a 3x phone repainted 1080 x 2364 pixels up
 * to 120 times a second while the player only read a card, and the GPU it shares with Android stayed so busy that
 * scrolling ran a second behind the finger and even the system's own notification shade stuttered.
 *
 * So each frame still runs every update (input, tweens, timers, the scenes' own `update`), and then a signature of
 * what would be drawn is taken: each visible scene's cameras and each visible object's position, scale, rotation,
 * alpha, depth, tint, texture frame, size, a Graphics' or a mask's drawing commands, a Shape's path. When it matches
 * the frame last drawn, the draw is skipped and the canvas keeps the last picture. What a signature can't see marks
 * the next frames dirty instead: a Text re-rendering its texture, a texture added or removed, a DynamicTexture
 * drawing, a resize, the page becoming visible again, the WebGL context coming back. A camera effect, a video,
 * particles, a shader, or a lazy label with text still to paint (`ui/lazy-text.ts` paints as it draws) always draw;
 * a label waiting on the text worker draws again once its bitmap is in. And whatever happens, a frame is drawn at least every `MAX_IDLE_MS`, so anything
 * still missed is late by at most that, never stuck.
 *
 * `?redraw=always` turns this off.
 */
import type Phaser from "phaser";

/** The longest the canvas goes without a fresh draw, whatever the signature says. */
export const MAX_IDLE_MS = 500;
/** Frames drawn unconditionally after something the signature can't see. */
const DIRTY_FRAMES = 2;

let hash = 0;

function mix(value: number): void {
  // 1/64 px is finer than any drawn difference; NaN and undefined count as 0.
  hash = Math.imul(hash ^ (Number.isFinite(value) ? Math.round(value * 64) | 0 : 0), 0x01000193);
}

function mixText(value: string): void {
  mix(value.length);
  for (let index = 0; index < value.length; index++) mix(value.charCodeAt(index));
}

function mixArray(values: readonly unknown[]): void {
  mix(values.length);
  for (const value of values) {
    if (typeof value === "number") mix(value);
    else if (typeof value === "boolean") mix(value ? 1 : 2);
    else if (typeof value === "string") mixText(value);
  }
}

/** An object type whose look can change with nothing in its signature changing: it always draws. */
const ALWAYS_DRAWS = new Set(["Video", "ParticleEmitter", "Shader", "Mesh", "Rope", "RenderTexture", "Plane"]);

/** What `signature` reads of a game object; every field is optional, as it is across Phaser's object types. */
export interface SignedObject {
  readonly type?: string;
  readonly visible?: boolean;
  readonly alpha?: number;
  readonly x?: number;
  readonly y?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotation?: number;
  readonly depth?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly width?: number;
  readonly height?: number;
  readonly flipX?: boolean;
  readonly flipY?: boolean;
  readonly blendMode?: number | string;
  readonly scrollFactorX?: number;
  readonly scrollFactorY?: number;
  readonly tintTopLeft?: number;
  readonly tintTopRight?: number;
  readonly tintBottomLeft?: number;
  readonly tintBottomRight?: number;
  readonly tintMode?: number;
  readonly fillColor?: number;
  readonly fillAlpha?: number;
  readonly strokeColor?: number;
  readonly strokeAlpha?: number;
  readonly lineWidth?: number;
  readonly isFilled?: boolean;
  readonly isStroked?: boolean;
  readonly tilePositionX?: number;
  readonly tilePositionY?: number;
  readonly isCropped?: boolean;
  readonly _crop?: { readonly x?: number; readonly y?: number; readonly width?: number; readonly height?: number };
  readonly frame?: { readonly name?: string | number; readonly texture?: { readonly key?: string } } | null;
  readonly commandBuffer?: readonly unknown[];
  /** `ui/lazy-text.ts`'s label: new text waits for the next draw to paint, or for the text worker's bitmap. */
  readonly lazyDirty?: boolean;
  readonly workerJob?: number;
  readonly pathData?: readonly number[];
  readonly list?: readonly SignedObject[];
  readonly mask?: { readonly active?: boolean; readonly maskGameObject?: SignedObject | null } | null;
  readonly filters?: {
    readonly internal?: { readonly list?: readonly { readonly active?: boolean }[] };
    readonly external?: { readonly list?: readonly { readonly active?: boolean }[] };
  } | null;
}

export interface SignedCamera {
  readonly visible?: boolean;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly scrollX?: number;
  readonly scrollY?: number;
  readonly zoom?: number;
  readonly rotation?: number;
  readonly alpha?: number;
  readonly backgroundColor?: { readonly color32?: number; readonly alphaGL?: number };
  readonly fadeEffect?: { readonly isRunning?: boolean };
  readonly flashEffect?: { readonly isRunning?: boolean };
  readonly shakeEffect?: { readonly isRunning?: boolean };
  readonly filters?: SignedObject["filters"];
}

export interface SignedScene {
  readonly key: string;
  readonly visible: boolean;
  readonly status: number;
  readonly cameras: readonly SignedCamera[];
  readonly children: readonly SignedObject[];
}

/** The signature of what is drawn, or null when this frame has to draw whatever it says (an effect, a video). */
export function signature(scenes: readonly SignedScene[]): number | null {
  hash = 0x811c9dc5;
  for (const scene of scenes) {
    mixText(scene.key);
    mix(scene.status);
    mix(scene.visible ? 1 : 2);
    if (!scene.visible) continue;
    for (const camera of scene.cameras) {
      if (camera.fadeEffect?.isRunning || camera.flashEffect?.isRunning || camera.shakeEffect?.isRunning) return null;
      mix(camera.visible === false ? 2 : 1);
      for (const value of [camera.x, camera.y, camera.width, camera.height, camera.scrollX, camera.scrollY])
        mix(value!);
      mix(camera.zoom!);
      mix(camera.rotation!);
      mix(camera.alpha!);
      mix(camera.backgroundColor?.color32 ?? 0);
      mix(camera.backgroundColor?.alphaGL ?? 0);
      mixFilters(camera.filters);
    }
    if (!signObjects(scene.children)) return null;
  }
  return hash;
}

function mixFilters(filters: SignedObject["filters"]): void {
  for (const list of [filters?.internal?.list, filters?.external?.list]) {
    mix(list?.length ?? 0);
    for (const filter of list ?? []) mix(filter.active ? 1 : 2);
  }
}

/** False when an object in the list always draws. */
function signObjects(objects: readonly SignedObject[]): boolean {
  mix(objects.length);
  for (const object of objects) {
    mix(object.visible === false ? 2 : 1);
    mix(object.alpha ?? 1);
    if (object.visible === false || object.alpha === 0) continue;
    if (object.type !== undefined && ALWAYS_DRAWS.has(object.type)) return false;
    mix(object.x!);
    mix(object.y!);
    mix(object.scaleX!);
    mix(object.scaleY!);
    mix(object.rotation!);
    mix(object.depth!);
    mix(object.originX!);
    mix(object.originY!);
    mix(object.width!);
    mix(object.height!);
    mix(object.flipX ? 1 : 2);
    mix(object.flipY ? 1 : 2);
    mix(typeof object.blendMode === "number" ? object.blendMode : 0);
    mix(object.scrollFactorX!);
    mix(object.scrollFactorY!);
    mix(object.tintTopLeft!);
    mix(object.tintTopRight!);
    mix(object.tintBottomLeft!);
    mix(object.tintBottomRight!);
    mix(object.tintMode!);
    mix(object.fillColor!);
    mix(object.fillAlpha!);
    mix(object.strokeColor!);
    mix(object.strokeAlpha!);
    mix(object.lineWidth!);
    mix(object.isFilled ? 1 : 2);
    mix(object.isStroked ? 1 : 2);
    mix(object.tilePositionX!);
    mix(object.tilePositionY!);
    if (object.isCropped && object._crop) {
      mix(object._crop.x!);
      mix(object._crop.y!);
      mix(object._crop.width!);
      mix(object._crop.height!);
    }
    const frame = object.frame;
    if (frame) {
      mixText(frame.texture?.key ?? "");
      if (typeof frame.name === "number") mix(frame.name);
      else mixText(frame.name ?? "");
    }
    if (object.commandBuffer) mixArray(object.commandBuffer);
    if (object.pathData) mixArray(object.pathData);
    if (object.lazyDirty) return false;
    mix(object.workerJob ?? -1);
    mixFilters(object.filters);
    const shape = object.mask?.maskGameObject;
    if (shape) {
      mix(shape.x!);
      mix(shape.y!);
      mix(shape.scaleX!);
      mix(shape.scaleY!);
      mix(shape.rotation!);
      if (shape.commandBuffer) mixArray(shape.commandBuffer);
      if (shape.pathData) mixArray(shape.pathData);
    }
    if (object.list && !signObjects(object.list)) return false;
  }
  return true;
}

let dirtyFrames = DIRTY_FRAMES;

/** Draws the next few frames whatever their signature: something changed that a signature can't see. */
export function markRenderDirty(): void {
  dirtyFrames = DIRTY_FRAMES;
}

type Step = (time: number, delta: number) => void;

interface GameInternals {
  step: Step;
  pendingDestroy: boolean;
  isPaused: boolean;
  runDestroy(): void;
  events: Phaser.Events.EventEmitter;
  scene: Phaser.Scenes.SceneManager & {
    isProcessing: boolean;
    update(time: number, delta: number): void;
    render(renderer: unknown): void;
  };
  renderer: Phaser.Renderer.WebGL.WebGLRenderer & {
    preRender(): void;
    postRender(): void;
    snapshotState?: { callback?: unknown };
  };
  textures: Phaser.Textures.TextureManager;
  scale: Phaser.Scale.ScaleManager;
  canvas: HTMLCanvasElement;
}

function scenesOf(game: GameInternals): SignedScene[] {
  return game.scene.scenes.map((scene) => ({
    key: scene.sys.settings.key,
    visible: scene.sys.settings.visible,
    status: scene.sys.settings.status,
    cameras: scene.cameras?.cameras ?? [],
    children: (scene.sys.displayList?.list ?? []) as readonly SignedObject[],
  }));
}

/**
 * Replaces `Game#step` with the same step that skips the draw when nothing would change. Call right after creating
 * the game, before anything else wraps `step` (`ui/frame-guard.ts`), with Phaser's namespace for its prototypes. Off
 * with `?redraw=always`; the Canvas renderer always draws.
 */
export function installIdleRender(target: Phaser.Game, phaser: typeof Phaser, search: string): void {
  if (new URLSearchParams(search).get("redraw") === "always") return;
  const game = target as unknown as GameInternals;

  // What a signature can't see.
  const text = phaser.GameObjects.Text.prototype as unknown as { updateText(): unknown };
  const updateText = text.updateText;
  text.updateText = function (this: unknown) {
    markRenderDirty();
    return updateText.call(this);
  };
  const dynamic = phaser.Textures.DynamicTexture.prototype as unknown as { render(): unknown };
  const render = dynamic.render;
  dynamic.render = function (this: unknown) {
    markRenderDirty();
    return render.call(this);
  };
  document.addEventListener("visibilitychange", markRenderDirty);
  // The texture and scale managers and the canvas exist once the game has booted.
  const listen = (): void => {
    game.textures.on(phaser.Textures.Events.ADD, markRenderDirty);
    game.textures.on(phaser.Textures.Events.REMOVE, markRenderDirty);
    game.scale.on(phaser.Scale.Events.RESIZE, markRenderDirty);
    game.canvas.addEventListener("webglcontextrestored", markRenderDirty);
  };
  if (target.isBooted) listen();
  else target.events.once(phaser.Core.Events.READY, listen);

  let last: number | null = null;
  let lastDrawn = Number.NEGATIVE_INFINITY;
  game.step = (time: number, delta: number): void => {
    if (game.pendingDestroy) return game.runDestroy();
    if (game.isPaused) return;
    const events = game.events;
    events.emit(phaser.Core.Events.PRE_STEP, time, delta);
    events.emit(phaser.Core.Events.STEP, time, delta);
    game.scene.update(time, delta);
    events.emit(phaser.Core.Events.POST_STEP, time, delta);

    const renderer = game.renderer;
    if ("gl" in renderer) {
      const now = signature(scenesOf(game));
      const snapshotWanted = Boolean(renderer.snapshotState?.callback);
      const unchanged = now !== null && now === last && dirtyFrames === 0 && !snapshotWanted;
      if (unchanged && time - lastDrawn < MAX_IDLE_MS) {
        // `SceneManager#update` raises `isProcessing` and only its `render` lowers it; left up, every `scene.add`
        // between frames would wait in the manager's queue.
        game.scene.isProcessing = false;
        return;
      }
      if (dirtyFrames > 0) dirtyFrames--;
      last = now;
      lastDrawn = time;
    }

    renderer.preRender();
    events.emit(phaser.Core.Events.PRE_RENDER, renderer, time, delta);
    game.scene.render(renderer);
    renderer.postRender();
    events.emit(phaser.Core.Events.POST_RENDER, renderer, time, delta);
  };
}
