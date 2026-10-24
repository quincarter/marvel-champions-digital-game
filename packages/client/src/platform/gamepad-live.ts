/**
 * Two fixes to Phaser's `Input.Gamepad.Gamepad#update`, installed once at startup.
 *
 * - **A reconnected pad stays dead.** Phaser keeps the browser `Gamepad` object it was built with and reads
 *   `connected` (and `mapping`) from it. When a controller drops and comes back at the same index with the same id, the
 *   plugin only calls `update(livePad)` on the old wrapper, so `connected` kept reading the dropped object's `false`
 *   and every poll skipped the pad (an 8BitDo dongle on Linux, 2026-10-24). The wrapper now holds the object the browser
 *   handed it last.
 * - **A pad's own clock.** Phaser drops every update whose `timestamp` is older than the wrapper's creation by
 *   `performance.now()`. That compares two clocks the Gamepad spec only says should match, and a webview that stamps
 *   pads on another one would have every update dropped. The check is turned off: what it guarded against, a button
 *   held across a scene change firing in the new scene, is already covered by Phaser building each `Button` as pressed
 *   when it is down at creation, so it fires no "down" until it is let go and pressed again.
 */
import type Phaser from "phaser";

export interface LivePad {
  readonly timestamp: number;
}

interface PadWrapper {
  pad: LivePad | null;
  _created: number;
}

const INSTALLED = Symbol.for("mc.gamepadLive");

/** What the patched `update` does to the wrapper before Phaser's own runs (exported for the tests). */
export function adoptLivePad(wrapper: PadWrapper, live: LivePad): void {
  wrapper.pad = live;
  wrapper._created = Number.NEGATIVE_INFINITY;
}

export function installGamepadLive(phaser: typeof Phaser): void {
  const proto = phaser.Input.Gamepad.Gamepad.prototype as unknown as {
    update(this: PadWrapper, pad: LivePad): void;
    [INSTALLED]?: true;
  };
  if (proto[INSTALLED]) return;
  proto[INSTALLED] = true;
  const update = proto.update;
  proto.update = function (this: PadWrapper, live: LivePad): void {
    adoptLivePad(this, live);
    update.call(this, live);
  };
}
