/**
 * Two fixes to Phaser's `Input.Gamepad.Gamepad#update`, installed once at startup.
 *
 * - **A reconnected pad stays dead.** Phaser keeps the browser `Gamepad` object it was built with and reads
 *   `connected` from it. When a controller drops and comes back at the same index with the same id, the plugin only
 *   calls `update(livePad)` on the old wrapper, so `connected` kept reading the dropped object's `false` and every
 *   poll skipped the pad until the screen was rebuilt (seen with an 8BitDo dongle on Linux, 2026-10-24). The wrapper now
 *   always holds the object the browser handed it last.
 * - **A pad's own clock.** Phaser drops every update whose `timestamp` is older than the wrapper's creation, by
 *   `performance.now()`, so a button held down across a scene change doesn't fire in the new scene. That compares
 *   two clocks the Gamepad spec only says should match; a webview that stamps pads on another clock (WebKitGTK reads
 *   them from libmanette) can have every update dropped. The same protection is kept without any clock: a button
 *   already down when the wrapper first updates reads as up until it is let go.
 */
import type Phaser from "phaser";

interface LiveButton {
  readonly value: number;
  readonly pressed: boolean;
}

export interface LivePad {
  readonly buttons: readonly LiveButton[];
  readonly axes: readonly number[];
  readonly timestamp: number;
}

const UP: LiveButton = { value: 0, pressed: false };

/**
 * The buttons still held since the wrapper's first update: `held` is null on that first update, and the set it
 * returns is what to pass next time. A button leaves the set once it is released.
 */
export function stillHeld(held: ReadonlySet<number> | null, buttons: readonly LiveButton[]): Set<number> {
  const next = new Set<number>();
  buttons.forEach((button, index) => {
    if (button.pressed && (held === null || held.has(index))) next.add(index);
  });
  return next;
}

/** The pad as Phaser should read it: the held buttons up, everything else as the browser reports it. */
export function maskHeld(pad: LivePad, held: ReadonlySet<number>): LivePad {
  if (held.size === 0) return pad;
  return { ...pad, buttons: pad.buttons.map((button, index) => (held.has(index) ? UP : button)) };
}

interface PadWrapper {
  pad: LivePad | null;
  _created: number;
  mcHeld?: Set<number>;
}

const INSTALLED = Symbol.for("mc.gamepadLive");

export function installGamepadLive(phaser: typeof Phaser): void {
  const proto = phaser.Input.Gamepad.Gamepad.prototype as unknown as {
    update(this: PadWrapper, pad: LivePad): void;
    [INSTALLED]?: true;
  };
  if (proto[INSTALLED]) return;
  proto[INSTALLED] = true;
  const update = proto.update;
  proto.update = function (this: PadWrapper, live: LivePad): void {
    this.pad = live;
    this.mcHeld = stillHeld(this.mcHeld ?? null, live.buttons);
    // The held mask replaces Phaser's timestamp check, which is turned off for good.
    this._created = Number.NEGATIVE_INFINITY;
    update.call(this, maskHeld(live, this.mcHeld));
    // Phaser's update reads the object it is given; `connected`, `id` and `mapping` are read from `pad` later.
    this.pad = live;
  };
}
