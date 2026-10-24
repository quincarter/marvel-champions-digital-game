/**
 * The controllers the desktop app reads natively on Linux (`src-tauri/src/gamepad_bridge.rs`), kept as the browser's
 * Gamepad API would show them, for `platform/native-gamepad.ts` to hand out from `navigator.getGamepads()`.
 *
 * The bridge pushes each pad's state as it changes, with the buttons that went down since its last message (`downs`).
 * The game only looks once a frame, so a tap shorter than a frame would be missed; a button in `downs` therefore reads
 * as pressed for `LATCH_FRAMES` frames even when it is already up again (`endFrame` counts them off).
 */

export interface BridgeButton {
  readonly pressed: boolean;
  readonly value: number;
}

export interface BridgePad {
  readonly index: number;
  readonly id: string;
  readonly connected: boolean;
  readonly buttons: readonly BridgeButton[];
  readonly axes: readonly number[];
  readonly timestamp: number;
  readonly downs: readonly number[];
}

export interface BridgeMessage {
  readonly kind: "connected" | "disconnected" | "state";
  readonly pad: BridgePad;
}

/** What `navigator.getGamepads()` returns for one pad: the fields the game and Phaser read. */
export interface ShimPad {
  readonly id: string;
  readonly index: number;
  readonly connected: boolean;
  readonly mapping: "standard";
  readonly timestamp: number;
  readonly axes: readonly number[];
  readonly buttons: readonly (BridgeButton & { readonly touched: boolean })[];
}

/** Frames a tapped button keeps reading as down: one for the frame that sees it, one to spare for frame order. */
export const LATCH_FRAMES = 2;

/** The slots a browser reports, empty ones as null. */
const SLOTS = 4;

export class NativePads {
  readonly #pads = new Map<number, BridgePad>();
  /** Per pad, each tapped button and the frames it has left. */
  readonly #latched = new Map<number, Map<number, number>>();
  #cache: (ShimPad | null)[] | null = null;

  /** Takes one bridge message in; true when a pad came or went. */
  apply(message: BridgeMessage): boolean {
    const { pad } = message;
    this.#cache = null;
    if (message.kind === "disconnected" || !pad.connected) {
      this.#pads.delete(pad.index);
      this.#latched.delete(pad.index);
      return true;
    }
    const known = this.#pads.has(pad.index);
    this.#pads.set(pad.index, pad);
    if (pad.downs.length > 0) {
      const latched = this.#latched.get(pad.index) ?? new Map<number, number>();
      for (const index of pad.downs) latched.set(index, LATCH_FRAMES);
      this.#latched.set(pad.index, latched);
    }
    return message.kind === "connected" || !known;
  }

  /** True while a tap is still being held down for the game to see. */
  get latching(): boolean {
    return this.#latched.size > 0;
  }

  /** A frame has passed: each tap held down loses one frame, and goes once it has none left. */
  endFrame(): void {
    if (this.#latched.size === 0) return;
    this.#cache = null;
    for (const [pad, latched] of this.#latched) {
      for (const [button, left] of latched) {
        if (left <= 1) latched.delete(button);
        else latched.set(button, left - 1);
      }
      if (latched.size === 0) this.#latched.delete(pad);
    }
  }

  /** The pads as `navigator.getGamepads()` reports them. The same array until something changes. */
  snapshot(): (ShimPad | null)[] {
    if (this.#cache) return this.#cache;
    const out: (ShimPad | null)[] = Array.from({ length: SLOTS }, () => null);
    for (const pad of this.#pads.values()) {
      if (pad.index < 0 || pad.index >= SLOTS) continue;
      const latched = this.#latched.get(pad.index);
      out[pad.index] = {
        id: pad.id,
        index: pad.index,
        connected: true,
        mapping: "standard",
        timestamp: pad.timestamp,
        axes: pad.axes,
        buttons: pad.buttons.map((button, index) =>
          !button.pressed && latched?.has(index)
            ? { pressed: true, value: 1, touched: true }
            : { ...button, touched: button.pressed },
        ),
      };
    }
    this.#cache = out;
    return out;
  }

  /** One pad as the browser would hand it to a `gamepadconnected` / `gamepaddisconnected` event. */
  eventPad(pad: BridgePad): ShimPad {
    return {
      id: pad.id,
      index: pad.index,
      connected: pad.connected,
      mapping: "standard",
      timestamp: pad.timestamp,
      axes: pad.axes,
      buttons: pad.buttons.map((button) => ({ ...button, touched: button.pressed })),
    };
  }
}
