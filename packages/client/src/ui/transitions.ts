/**
 * How overlays and screens come and go.
 *
 * Two shapes, both from the design's own rule that depth is border weight and
 * ground swaps, never shadows or motion for its own sake:
 *
 *  - **An overlay rises into place** (`enterOverlay`): its scrim fades in and
 *    its panels come up a few pixels while fading in, over `motion.overlayEnterMs`.
 *    Leaving (`exitOverlay`) is the reverse and shorter — the player has already
 *    decided — and only then does the scene stop.
 *  - **A screen gives way to the next** (`fadeScreenIn` / `goToScreen`): a short
 *    fade through the void, so Title → Scenario → Seats reads as pages turning
 *    rather than as a hard cut.
 *
 * Every scene here redraws its whole display list on every store update
 * (`destroyChildren`), and every overlay draws at least twice at open, because
 * `SessionStore.subscribe` delivers the current state immediately and `create`
 * draws once more itself. So the entrance is held as a *start time*
 * (`OverlayMotion`), the shape the Board's beats and travels already use: each
 * draw inside the entrance window re-creates the objects already partway along
 * and tweens the remainder, and a draw after the window lands opaque.
 * `OverlayMotion` also keeps the "already leaving" flag, so a second Escape
 * during the exit is ignored rather than stopping the scene twice.
 *
 * Reduced motion (`appSession().settings.reducedMotion`): nothing moves and
 * nothing fades; the overlay is simply there, and then simply gone. The
 * information is identical — that's the whole contract of the setting.
 */

import type Phaser from "phaser";
import { appSession } from "../session.js";
import { motion, surface } from "../tokens.js";
import { isStartPending, LAZY_SCENE_KEYS, sceneLoader } from "../scenes/scene-loader.js";
import { needed } from "../scenes/scene-order.js";
import { holdLabelsOnMain, labelsWaitingForPaint, prewarmTextPainter } from "./lazy-text.js";

type Fadeable = Phaser.GameObjects.GameObject & { alpha: number; y: number; setAlpha(value: number): unknown };

export interface OverlayEntrance {
  /** The scrim(s): fade in only, never move. */
  readonly scrim?: readonly Phaser.GameObjects.GameObject[];
  /** The panel objects (graphics, text, widget containers): fade in and rise `rise` px. */
  readonly panels: readonly Phaser.GameObjects.GameObject[];
  /** How far the panels travel upward as they appear. Default 14px; a bottom sheet may use more. */
  readonly rise?: number;
  /** Override the duration (e.g. a bottom sheet sliding up). */
  readonly durationMs?: number;
}

/** How far an entering overlay's panels rise, by default. */
const DEFAULT_RISE = 14;

function reduced(): boolean {
  return appSession().settings.reducedMotion;
}

/**
 * Only objects that really carry an alpha. A Phaser `Zone` has a no-op
 * `setAlpha` but no `alpha` property (it is a hit area, not a drawing), and
 * a tween built on `alpha: undefined` throws inside Phaser — and a zone must
 * never be shifted by the rise either, or the hit areas land 14px off.
 */
const fadeables = (objects: readonly Phaser.GameObjects.GameObject[]): Fadeable[] =>
  objects.filter(
    (object): object is Fadeable =>
      typeof (object as Fadeable).alpha === "number" &&
      typeof (object as Fadeable).setAlpha === "function" &&
      typeof (object as Fadeable).y === "number",
  );

/** Objects that animate themselves on the way in, so an entrance must leave them alone. */
const outOfEntrance = new WeakSet<Phaser.GameObjects.GameObject>();

/** Keeps `objects` out of the entrance of the overlay they're drawn in (`enterOverlay`). The exit still fades them. */
export function skipEntrance(...objects: readonly Phaser.GameObjects.GameObject[]): void {
  for (const object of objects) outOfEntrance.add(object);
}

/**
 * Plays the entrance on the objects a scene just drew, from `elapsedMs` into
 * it: a draw that happens mid-entrance places everything where the tween would
 * already have it and tweens the rest. Prefer `OverlayMotion.enter`, which does
 * the timekeeping.
 */
export function enterOverlay(scene: Phaser.Scene, entrance: OverlayEntrance, elapsedMs = 0): void {
  if (reduced()) return;
  const duration = entrance.durationMs ?? motion.overlayEnterMs;
  const remaining = duration - elapsedMs;
  if (remaining <= 0) return;
  const progress = Math.min(1, Math.max(0, elapsedMs / duration));
  const rise = entrance.rise ?? DEFAULT_RISE;
  const scrims = fadeables(entrance.scrim ?? []);
  const panels = fadeables(entrance.panels).filter((object) => !outOfEntrance.has(object));
  for (const object of scrims) {
    const to = object.alpha;
    object.setAlpha(to * progress);
    scene.tweens.add({ targets: object, alpha: to, duration: remaining, ease: "Quad.easeOut" });
  }
  for (const object of panels) {
    const to = object.alpha;
    const y = object.y;
    object.setAlpha(to * progress);
    object.y = y + rise * (1 - progress);
    scene.tweens.add({ targets: object, alpha: to, y, duration: remaining, ease: "Quad.easeOut" });
  }
}

type Movable = Phaser.GameObjects.GameObject & { x: number; y: number };

const movables = (objects: readonly Phaser.GameObjects.GameObject[]): Movable[] =>
  objects.filter(
    (object): object is Movable =>
      typeof (object as Movable).x === "number" && typeof (object as Movable).y === "number",
  );

/**
 * A docked panel sliding in from off its edge: the objects start `from` away and travel home. Like `enterOverlay`, a
 * redraw inside the window resumes from where the slide had got to (`elapsedMs` since it began). Nothing moves under
 * reduced motion.
 */
export function slideIn(
  scene: Phaser.Scene,
  objects: readonly Phaser.GameObjects.GameObject[],
  from: { readonly dx: number; readonly dy: number },
  elapsedMs: number,
  durationMs: number = motion.dockSlideInMs,
): void {
  if (reduced()) return;
  const remaining = durationMs - elapsedMs;
  if (remaining <= 0) return;
  // Cubic ease-out, so the part already travelled matches the curve the tween finishes on.
  const progress = 1 - Math.pow(1 - Math.min(1, Math.max(0, elapsedMs / durationMs)), 3);
  for (const object of movables(objects)) {
    const { x, y } = object;
    object.x = x + from.dx * (1 - progress);
    object.y = y + from.dy * (1 - progress);
    scene.tweens.add({ targets: object, x, y, duration: remaining, ease: "Cubic.easeOut" });
  }
}

/** Everything on the scene sliding `to` away (off its edge), then `done`. Immediate under reduced motion. */
export function slideOut(
  scene: Phaser.Scene,
  to: { readonly dx: number; readonly dy: number },
  done: () => void,
  durationMs: number = motion.dockSlideOutMs,
): void {
  const targets = movables(scene.children.list);
  if (reduced() || targets.length === 0) {
    done();
    return;
  }
  for (const object of targets) {
    scene.tweens.add({
      targets: object,
      x: object.x + to.dx,
      y: object.y + to.dy,
      duration: durationMs,
      ease: "Cubic.easeIn",
    });
  }
  scene.time.delayedCall(durationMs, done);
}

/**
 * Fades everything currently on the scene's display list out, then calls
 * `done` (which is where the caller stops the scene). Immediate under reduced
 * motion. Input is not blocked here — callers gate on `OverlayMotion.leaving`.
 */
export function exitOverlay(scene: Phaser.Scene, done: () => void, durationMs: number = motion.overlayExitMs): void {
  if (reduced()) {
    done();
    return;
  }
  const targets = fadeables(scene.children.list);
  if (targets.length === 0) {
    done();
    return;
  }
  scene.tweens.add({ targets, alpha: 0, duration: durationMs, ease: "Quad.easeIn", onComplete: done });
}

/**
 * The per-scene bookkeeping for an overlay that redraws itself on every store
 * update: `enter` starts the entrance clock on the first draw after `create`
 * and, on every later draw inside the entrance window, re-creates the entrance
 * from where it had got to; `exit` runs the exit exactly once.
 *
 *   #motion = new OverlayMotion();
 *   create() { this.#motion = new OverlayMotion(); … this.#draw(); }
 *   #draw()  { …draw scrim and panels…; this.#motion.enter(this, { scrim: [scrim], panels }); }
 *   #close() { this.#motion.exit(this, () => this.scene.stop()); }
 *
 * `leaving` is true from the moment `exit` is called, so a draw or a button
 * handler can decline to act on a scene that is already on its way out.
 */
export class OverlayMotion {
  /** When the first draw of this open happened (`scene.time.now`); null until it has. */
  #openedAt: number | null = null;
  #leaving = false;

  get leaving(): boolean {
    return this.#leaving;
  }

  enter(scene: Phaser.Scene, entrance: OverlayEntrance): void {
    if (this.#leaving) return;
    // Every draw of an overlay that is not leaving takes input — the other half of `exit` switching it off.
    scene.input.enabled = true;
    const now = scene.time.now;
    this.#openedAt ??= now;
    enterOverlay(scene, entrance, now - this.#openedAt);
  }

  /** `run` replaces the fade (a docked panel slides out instead); it must call `done` once, when it has finished. */
  exit(scene: Phaser.Scene, done: () => void, durationMs?: number, run?: (done: () => void) => void): void {
    if (this.#leaving) return;
    this.#leaving = true;
    // A leaving overlay takes no input, from the moment it starts to go. It is fading, or (under reduced motion, or
    // the choice sheet waiting on the engine) still fully drawn while it waits to be stopped — and an overlay above
    // the one the player is looking at must never be the thing that swallows their click. Switched back on by the
    // next `enter` (a sheet that comes back) and by shutdown, so a relaunched scene always starts answerable.
    scene.input.enabled = false;
    scene.events.once("shutdown", () => {
      scene.input.enabled = true;
    });
    if (run) run(done);
    else exitOverlay(scene, done, durationMs);
  }
}

/**
 * A full screen's own entrance: fade in from the void. Call at the end of a
 * screen scene's `create`. A no-op under reduced motion. A screen that has data
 * still to arrive can hold this entrance until it has (`holdScreenFor`).
 */
export function fadeScreenIn(scene: Phaser.Scene, durationMs: number = motion.screenFadeMs): void {
  if (reduced()) return;
  const { r, g, b } = rgbOf(surface.void.hex);
  scene.cameras.main.fadeIn(durationMs, r, g, b);
  const entrance: Entrance = { durationMs, frame: scene.sys.game.loop.frame };
  entrances.set(scene, entrance);
  scene.events.once("shutdown", () => {
    if (entrances.get(scene) === entrance) entrances.delete(scene);
  });
}

/** A `fadeScreenIn` just made: a `holdScreenFor` in the same frame turns it into a held entrance. */
interface Entrance {
  readonly durationMs: number;
  readonly frame: number;
}

const entrances = new WeakMap<Phaser.Scene, Entrance>();

/** A screen's entrance waiting to begin (`holdScreenFor`). */
interface ScreenHold {
  wait(promise: Promise<unknown>): void;
  cancel(): void;
}

const holds = new WeakMap<Phaser.Scene, ScreenHold>();

/** The held fade's nominal length: long enough that it never moves while it is reset each frame. */
const SCREEN_HOLD_FADE_MS = 1_000_000;

/**
 * Keeps a screen on the void until `promise` settles and the screen has rendered with every label painted, then
 * fades it in; at most `motion.screenHoldMaxMs` after the hold began. For a screen whose first draw is followed at
 * once by another as its data arrives (unlocks, saves, a catalog, a picture), which would otherwise be seen filling
 * in and blinking as it redraws. Call it in `create`, right after `fadeScreenIn`; several calls wait for all their
 * promises. While held, the screen's labels are painted by the text worker, as at any other time (issue #722: painting
 * them on the main thread here made a 17 ms frame of its own); the hold waits for them, so
 * the screen fades in whole. A no-op under reduced motion, and once the
 * screen's entrance has begun.
 */
/** True while `scene` is held on the void, waiting to fade in (`holdScreenFor`). */
export function isScreenHeld(scene: Phaser.Scene): boolean {
  return holds.has(scene);
}

export function holdScreenFor(scene: Phaser.Scene, promise: Promise<unknown>): void {
  const held = holds.get(scene);
  if (held) {
    held.wait(promise);
    return;
  }
  const entrance = entrances.get(scene);
  if (!entrance || entrance.frame !== scene.sys.game.loop.frame) return;
  entrances.delete(scene);
  startHold(scene, entrance.durationMs).wait(promise);
}

function startHold(scene: Phaser.Scene, durationMs: number): ScreenHold {
  const { r, g, b } = rgbOf(surface.void.hex);
  const camera = scene.cameras.main;
  const startedAt = performance.now();
  let waiting = 0;
  // Held as a fade-in that does not advance: the camera's fade is still running, which is what the idle renderer,
  // `goToScreen` and a screen waiting on `FADE_IN_COMPLETE` read.
  camera.fadeIn(SCREEN_HOLD_FADE_MS, r, g, b, () => {
    if (holds.get(scene) === hold) (camera.fadeEffect as unknown as { _elapsed: number })._elapsed = 0;
  });
  const stop = (): void => {
    holds.delete(scene);
    holdLabelsOnMain(scene, false);
    scene.events.off("render", check);
  };
  // After a render, not before it: labels are painted when they are drawn, so only then is "nothing waiting" true.
  const check = (): void => {
    if (holds.get(scene) !== hold) return;
    const ready = waiting === 0 && labelsWaitingForPaint() === 0;
    if (!ready && performance.now() - startedAt < motion.screenHoldMaxMs) return;
    // Out of time with labels the worker hasn't painted yet (a slow device): paint them on the main thread in this last
    // held frame, so the screen still fades in whole. One long frame, on the void, and only then.
    if (labelsWaitingForPaint() > 0) holdLabelsOnMain(scene, true);
    stop();
    camera.fadeIn(durationMs, r, g, b);
  };
  const hold: ScreenHold = {
    wait: (promise) => {
      waiting++;
      const settled = (): void => {
        waiting--;
      };
      void promise.then(settled, settled);
    },
    cancel: stop,
  };
  holds.set(scene, hold);
  scene.events.on("render", check);
  scene.events.once("shutdown", () => {
    if (holds.get(scene) === hold) stop();
  });
  return hold;
}

/**
 * Objects just drawn whose labels may still be painting (a new tab's shelf, drawn through `paintScrolledIn`): hidden
 * until every label waiting on the text worker is in (or `motion.revealMaxMs` has passed), then faded in over
 * `motion.revealMs`. Under reduced motion they are simply shown.
 */
export function revealWhenPainted(scene: Phaser.Scene, objects: readonly Phaser.GameObjects.GameObject[]): void {
  if (reduced()) return;
  // A label is painted when it is first measured or drawn, and a hidden one is never drawn: measure them now, so
  // what they need is under way before they are hidden.
  for (const object of objects) if (isText(object)) void object.width;
  const targets = fadeables(objects).map((object) => ({ object, alpha: object.alpha }));
  for (const { object } of targets) object.setAlpha(0);
  const startedAt = performance.now();
  const check = (): void => {
    if (performance.now() - startedAt < motion.revealMaxMs && labelsWaitingForPaint() > 0) return;
    scene.events.off("postupdate", check);
    for (const { object, alpha } of targets) {
      if (!object.scene) continue;
      scene.tweens.add({ targets: object, alpha, duration: motion.revealMs, ease: "Quad.easeOut" });
    }
  };
  // On update, not render: the idle renderer draws nothing while these are hidden, and their labels were measured
  // above, so nothing waits on a render.
  scene.events.on("postupdate", check);
  scene.events.once("shutdown", () => scene.events.off("postupdate", check));
}

const isText = (object: Phaser.GameObjects.GameObject): object is Phaser.GameObjects.Text => object.type === "Text";

/**
 * Leaves this screen for `key`: fade out to the void, then `scene.start`.
 * Use in place of a bare `this.scene.start(key, data)` wherever one screen
 * hands off to another (never for an overlay `launch`, which runs over the
 * board). Immediate under reduced motion. A second call while already fading
 * *out* is ignored, so a double-click on "Start game" starts one game.
 *
 * **Only guards against a fade already leaving, not one still arriving.** A
 * scene whose own entrance fade-in (`fadeScreenIn`, `create()`) hasn't
 * finished can still call this the moment async setup work resolves — a
 * screen with no slow network/image step (e.g. `CampaignAftermathScene`
 * folding a loss straight from IndexedDB) can finish well inside the 200ms
 * entrance fade. `Camera.FadeEffect.direction` (`true` = fading out) is what
 * tells the two apart; checking only `isRunning` here made a fast async
 * chain's `goToScreen` a silent no-op — no error, no navigation, the screen
 * just sat on its own faded-in frame forever. Found live (agent C, Aftermath's
 * loss → Rewind hand-off, played back through a real concede rather than
 * guessed at).
 */
export function goToScreen(
  scene: Phaser.Scene,
  key: string,
  data?: object,
  durationMs: number = motion.screenFadeMs,
): void {
  // Phaser keeps a scene's last start data when `start` gets none (`Systems#start` only assigns a truthy `data`), so
  // a bare "back to Title" would replay the Decks screen's "Play this deck" hand-off and bounce straight to Take
  // your seats again, forever. Every screen change passes an object, empty when the caller has nothing to say.
  data ??= {};
  // The chunk of the screen being left for is still arriving (`scenes/scene-loader.ts`): a second tap must not queue a second start.
  if (isStartPending(scene.scene) || preloading.has(scene)) return;
  // The next screen's labels are painted in the text worker; start it now if it ended, so the fade covers its start.
  prewarmTextPainter();
  // The next screen's code first, while this one is still up and answering: fading out and then waiting on a chunk
  // left the void on screen for as long as the download took. Tried once: a chunk that fails to load is left to the
  // scene loader, which reports it, as before.
  const loader = sceneLoader();
  const missing = loader ? needed(key).filter((one) => LAZY_SCENE_KEYS.includes(one) && !loader.isRegistered(one)) : [];
  if (loader && missing.length > 0) {
    preloading.add(scene);
    let left = false;
    const leave = (): void => {
      left = true;
      preloading.delete(scene);
    };
    scene.events.once("shutdown", leave);
    void Promise.all(missing.map((one) => loader.load(one)))
      .catch(() => undefined)
      .finally(() => {
        // The screen was left (or reopened, as Phaser reuses the instance) meanwhile: that tap no longer applies.
        if (left) return;
        scene.events.off("shutdown", leave);
        preloading.delete(scene);
        leaveScreen(scene, key, data, durationMs);
      });
    return;
  }
  leaveScreen(scene, key, data, durationMs);
}

/** `goToScreen` once the next screen's code is in. */
function leaveScreen(scene: Phaser.Scene, key: string, data: object, durationMs: number): void {
  // Still on the void, waiting to fade in: there is nothing on screen to fade out.
  const hold = holds.get(scene);
  if (reduced() || durationMs <= 0 || hold) {
    hold?.cancel();
    scene.scene.start(key, data);
    return;
  }
  const camera = scene.cameras.main;
  if (camera.fadeEffect.isRunning && camera.fadeEffect.direction) return;
  const { r, g, b } = rgbOf(surface.void.hex);
  camera.once("camerafadeoutcomplete", () => scene.scene.start(key, data));
  camera.fadeOut(durationMs, r, g, b);
}

/** Screens whose `goToScreen` is waiting on the next screen's code, so a second tap meanwhile is ignored. */
const preloading = new WeakSet<Phaser.Scene>();

const rgbOf = (hex: number): { r: number; g: number; b: number } => ({
  r: (hex >> 16) & 0xff,
  g: (hex >> 8) & 0xff,
  b: hex & 0xff,
});
