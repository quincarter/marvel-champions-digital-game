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
  const panels = fadeables(entrance.panels);
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

  exit(scene: Phaser.Scene, done: () => void, durationMs?: number): void {
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
    exitOverlay(scene, done, durationMs);
  }
}

/**
 * A full screen's own entrance: fade in from the void. Call at the end of a
 * screen scene's `create`. A no-op under reduced motion.
 */
export function fadeScreenIn(scene: Phaser.Scene, durationMs: number = motion.screenFadeMs): void {
  if (reduced()) return;
  const { r, g, b } = rgbOf(surface.void.hex);
  scene.cameras.main.fadeIn(durationMs, r, g, b);
}

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
  if (reduced() || durationMs <= 0) {
    scene.scene.start(key, data);
    return;
  }
  const camera = scene.cameras.main;
  if (camera.fadeEffect.isRunning && camera.fadeEffect.direction) return;
  const { r, g, b } = rgbOf(surface.void.hex);
  camera.once("camerafadeoutcomplete", () => scene.scene.start(key, data));
  camera.fadeOut(durationMs, r, g, b);
}

const rgbOf = (hex: number): { r: number; g: number; b: number } => ({
  r: (hex >> 16) & 0xff,
  g: (hex >> 8) & 0xff,
  b: hex & 0xff,
});
