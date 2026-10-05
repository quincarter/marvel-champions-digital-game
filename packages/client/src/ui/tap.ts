/**
 * `onTap`: a plain zone's tap, for the controls that aren't a `McButton` but still need `McButton`'s own guard —
 * a press and a release both seen by this zone, within the tap slop (`view/press-arm.ts`). A bare `pointerup`
 * listener fires for any release over the zone, including the end of a scroll that merely lifted there.
 *
 * Every tap control (this, `McButton`, a row tap zone) also registers with its scene's tap router below, which is
 * what keeps a tap that straddles a redraw: a control is judged by where the press went down and came up, not by
 * which zone instance existed at each moment.
 */
import Phaser from "phaser";
import { PressArm, TapTracker, type PressTarget } from "../view/press-arm.js";

interface TapEntry {
  /** Stable across a redraw: the same control drawn again has the same id. */
  readonly id: () => string;
  readonly zone: Phaser.GameObjects.Zone;
  /** Runs the control's own checks (enabled, clip, suppressClick) and its action. */
  readonly fire: (pointer: Phaser.Input.Pointer) => void;
}

class SceneTaps {
  readonly entries: TapEntry[] = [];
  readonly tracker = new TapTracker();
  readonly #scene: Phaser.Scene;
  readonly #stop: () => void;

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    const input = scene.input;
    const onDown = (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void =>
      this.tracker.down(
        pointer.id,
        this.#target(pointer, over),
        { x: pointer.x, y: pointer.y },
        performance.now(),
        pointer.wasTouch,
        pointer.downTime,
      );
    const onMove = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.isDown) this.tracker.move(pointer.id, { x: pointer.x, y: pointer.y }, this.#target(pointer, null));
    };
    const onUp = (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
      const id = this.tracker.up(
        pointer.id,
        this.#target(pointer, over),
        { x: pointer.x, y: pointer.y },
        performance.now(),
        pointer.downTime,
      );
      if (id === null) return;
      // The topmost control with that id now: the one the press began on may be a destroyed twin.
      this.#entryAt(pointer.x, pointer.y, id)?.fire(pointer);
    };
    const onOutside = (pointer: Phaser.Input.Pointer): void => this.tracker.cancel(pointer.id);
    input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
    input.on(Phaser.Input.Events.POINTER_UP, onUp);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onOutside);
    this.#stop = () => {
      input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
      input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
      input.off(Phaser.Input.Events.POINTER_UP, onUp);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onOutside);
    };
  }

  stop(): void {
    this.#stop();
  }

  /** What is under the pointer: the topmost live tap control by its own rect, and whether another object took the hit. */
  #target(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] | null): PressTarget {
    const top = over?.[0];
    const foreign = top !== undefined && !this.entries.some((entry) => entry.zone === top);
    if (this.#coveredAbove(pointer.x, pointer.y)) return { id: null, foreign };
    const entry = this.#entryAt(pointer.x, pointer.y, null);
    return { id: entry ? entry.id() : null, foreign };
  }

  /** Another active scene drawn above this one has a control at the point: it owns the press. */
  #coveredAbove(x: number, y: number): boolean {
    const scenes = this.#scene.sys.game.scene.getScenes(true);
    const index = scenes.indexOf(this.#scene);
    for (const above of scenes.slice(index + 1)) {
      const taps = ROUTERS.get(above);
      if (taps && taps.#entryAt(x, y, null)) return true;
    }
    return false;
  }

  #entryAt(x: number, y: number, id: string | null): TapEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (!usable(entry.zone)) continue;
      if (id !== null && entry.id() !== id) continue;
      const rect = worldRect(entry.zone);
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return entry;
    }
    return undefined;
  }
}

const ROUTERS = new WeakMap<Phaser.Scene, SceneTaps>();

/** A zone that can take a press right now: alive, interactive and not hidden under an invisible parent. */
function usable(zone: Phaser.GameObjects.Zone): boolean {
  if (!zone.active || !zone.input?.enabled) return false;
  for (let o: Phaser.GameObjects.GameObject | null = zone; o; o = o.parentContainer) {
    if (!o.active || (o as { visible?: boolean }).visible === false) return false;
  }
  return true;
}

/** The zone's rectangle on screen, through any container it sits in (a scrolling list's row layer moves it). */
function worldRect(zone: Phaser.GameObjects.Zone): { x: number; y: number; width: number; height: number } {
  const m = zone.getWorldTransformMatrix();
  const width = zone.width * Math.abs(m.scaleX);
  const height = zone.height * Math.abs(m.scaleY);
  return { x: m.tx - zone.originX * width, y: m.ty - zone.originY * height, width, height };
}

/**
 * Registers a tap control with its scene's router: a press that went down and came up over `id` completes
 * through `fire` even when the zone that saw the press was rebuilt in between (or did not exist yet). `fire` must
 * call `noteTapFired` when it presses, so the router never presses a second time for the same gesture.
 */
export function registerTap(
  scene: Phaser.Scene,
  zone: Phaser.GameObjects.Zone,
  id: () => string,
  fire: (pointer: Phaser.Input.Pointer) => void,
): void {
  let taps = ROUTERS.get(scene);
  if (!taps) {
    taps = new SceneTaps(scene);
    const own = taps;
    ROUTERS.set(scene, own);
    // A scene that shuts down and starts again is the same object with a fresh input plugin: drop the router so the
    // next control builds a new one, bound to the live plugin.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      own.stop();
      if (ROUTERS.get(scene) === own) ROUTERS.delete(scene);
    });
  }
  const entry: TapEntry = { id, zone, fire };
  taps.entries.push(entry);
  const owner = taps;
  zone.once(Phaser.GameObjects.Events.DESTROY, () => {
    const at = owner.entries.indexOf(entry);
    if (at >= 0) owner.entries.splice(at, 1);
  });
}

/** An object handler pressed its control for this pointer's gesture: the router must not press it again. */
export function noteTapFired(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): void {
  ROUTERS.get(scene)?.tracker.markFired(pointer.id);
}

/** The stable id of a control drawn at `rect` with `label`: where it is and what it says. */
export function tapId(
  prefix: string,
  rect: { x: number; y: number; width: number; height: number },
  label = "",
): string {
  return `${prefix}:${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}|${label}`;
}

export function onTap(
  zone: Phaser.GameObjects.Zone,
  activate: (pointer: Phaser.Input.Pointer) => void,
  /** A stable id for this control (default: where it is), so the router can complete a tap across a redraw. */
  id?: string,
): void {
  const press = new PressArm();
  const scene = zone.scene;
  const fire = (pointer: Phaser.Input.Pointer): void => {
    noteTapFired(scene, pointer);
    activate(pointer);
  };
  zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => press.down(pointer.x, pointer.y));
  zone.on("pointerout", () => press.cancel());
  zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (press.up(pointer.x, pointer.y)) fire(pointer);
  });
  const fixed = id ?? tapId("tap", worldRect(zone));
  registerTap(scene, zone, () => fixed, fire);
}
