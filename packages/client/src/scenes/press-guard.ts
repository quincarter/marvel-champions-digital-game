/**
 * A question that can pop up under the player's thumbs (device sync's conflict prompt raised by a background sync, the
 * sync screen's join step) must not take a press that was meant for the screen before it. `PressGuard` is `armed` only
 * once a minimum time has passed since it was (re)started, long enough for the panel to finish opening, and no pad
 * button has been held since: a screen routes `blocked: () => !guard.armed` so a stray A or Start does nothing.
 */
import type Phaser from "phaser";

const POLL_MS = 50;

/** True while any connected pad has a button down. */
export function anyPadButtonHeld(): boolean {
  const pads = globalThis.navigator?.getGamepads?.() ?? [];
  return [...pads].some((pad) => pad?.buttons.some((button) => button.pressed));
}

export class PressGuard {
  readonly #scene: Phaser.Scene;
  readonly #minMs: number;
  readonly #held: () => boolean;
  #armed = false;
  #timer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, minMs = 500, held: () => boolean = anyPadButtonHeld) {
    this.#scene = scene;
    this.#minMs = minMs;
    this.#held = held;
    this.restart();
  }

  get armed(): boolean {
    return this.#armed;
  }

  /** Disarms and waits again (a new step or panel just appeared). */
  restart(): void {
    this.#armed = false;
    this.#timer?.remove(false);
    let waited = 0;
    this.#timer = this.#scene.time.addEvent({
      delay: POLL_MS,
      loop: true,
      callback: () => {
        waited += POLL_MS;
        if (waited < this.#minMs || this.#held()) return;
        this.#armed = true;
        this.#timer?.remove(false);
        this.#timer = null;
      },
    });
  }
}
