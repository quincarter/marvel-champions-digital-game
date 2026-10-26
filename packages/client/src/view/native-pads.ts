/**
 * The controllers the desktop app reads natively on Linux (`src-tauri/src/gamepad_bridge.rs`), kept as the browser's
 * Gamepad API would show them, for `platform/native-gamepad.ts` to hand out from `navigator.getGamepads()`.
 *
 * One object per slot, changed in place, as a browser's own are: Phaser keeps the object it was handed
 * (`platform/gamepad-live.ts`) and reads `connected` from it, so a pad that drops reads `connected: false` with every
 * button up rather than freezing with whatever it last held down.
 *
 * The bridge pushes each pad's state as it changes, with the buttons that went down since its last message (`downs`).
 * The game only looks once a step, so a tap shorter than a step would be missed; a button in `downs` therefore reads
 * as pressed for `LATCH_STEPS` game steps even when it is already up again (`endStep` counts them off). The analog
 * triggers keep their own value instead, so a latch can't fire a full pull that never happened.
 *
 * With Steam Input on, Steam's virtual pad (Valve's vendor id 28de, product 11ff) mirrors the physical one, so one
 * controller would show up twice and every press would land twice. The virtual pad reads as disconnected once a pad of
 * its own has given any input; a virtual pad that is the only one working (Steam's own remap of a pad the app can't
 * read) stays.
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

export type BridgeMessage =
  | { readonly kind: "connected" | "disconnected" | "state"; readonly pad: BridgePad }
  | { readonly kind: "stopped" };

/** What `navigator.getGamepads()` returns for one pad: the fields the game and Phaser read. */
export interface ShimPad {
  readonly id: string;
  readonly index: number;
  readonly connected: boolean;
  readonly mapping: "standard";
  readonly timestamp: number;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number; readonly touched: boolean }[];
}

interface SlotPad {
  id: string;
  index: number;
  connected: boolean;
  mapping: "standard";
  timestamp: number;
  axes: number[];
  buttons: { pressed: boolean; value: number; touched: boolean }[];
}

/** Game steps a tapped button keeps reading as down: one for the step that sees it, one to spare. */
export const LATCH_STEPS = 2;

/** The slots a browser reports, empty ones as null. */
export const SLOTS = 4;

/** The analog triggers, which keep their own value rather than latching. */
const TRIGGERS = new Set([6, 7]);

/** Steam Input's virtual gamepad, as the bridge's id spells it. */
export function isSteamVirtualPad(id: string): boolean {
  return /Vendor: 28de Product: 11ff/i.test(id);
}

/**
 * True when a bridge message shows the player using the pad: a button went down or is held, or a stick is pushed well
 * past its rest (a resting stick drifts, so a small lean is not input). This is what switches the glyphs to the pad's,
 * for a pad the bridge reads, without waiting for the game's own gamepad plugin to notice the press.
 */
export function isDeliberatePadInput(pad: BridgePad): boolean {
  return (
    pad.connected &&
    (pad.downs.length > 0 ||
      pad.buttons.some((button) => button.pressed) ||
      pad.axes.some((axis) => Math.abs(axis) > 0.5))
  );
}

export class NativePads {
  /** The last message per slot from a connected pad. */
  readonly #pads = new Map<number, BridgePad>();
  /** Per slot, each tapped button and the steps it has left. */
  readonly #latched = new Map<number, Map<number, number>>();
  /** The slots that have given any input since their pad connected. */
  readonly #active = new Set<number>();
  /** What `navigator.getGamepads()` hands out: the same objects, changed in place. */
  readonly #out: (SlotPad | null)[] = Array.from({ length: SLOTS }, () => null);

  /** Takes one pad message in; true when a pad came or went. */
  apply(message: { readonly kind: "connected" | "disconnected" | "state"; readonly pad: BridgePad }): boolean {
    const { pad } = message;
    if (pad.index < 0 || pad.index >= SLOTS) return false;
    if (message.kind === "disconnected" || !pad.connected) {
      this.#pads.delete(pad.index);
      this.#latched.delete(pad.index);
      this.#active.delete(pad.index);
      this.#publish();
      return true;
    }
    const known = this.#pads.has(pad.index);
    this.#pads.set(pad.index, pad);
    // Deliberate input only: a resting stick's drift must not mark the player's own pad in use, or Steam's virtual pad
    // would stay hidden for good while it may be the one with the working mapping.
    if (isDeliberatePadInput(pad)) this.#active.add(pad.index);
    if (pad.downs.length > 0) {
      const latched = this.#latched.get(pad.index) ?? new Map<number, number>();
      for (const index of pad.downs) if (!TRIGGERS.has(index)) latched.set(index, LATCH_STEPS);
      if (latched.size > 0) this.#latched.set(pad.index, latched);
    }
    this.#publish();
    return message.kind === "connected" || !known;
  }

  /** True while a tap is still being held down for the game to see. */
  get latching(): boolean {
    return this.#latched.size > 0;
  }

  /** A game step has passed: each tap held down loses one step, and goes once it has none left. */
  endStep(): void {
    if (this.#latched.size === 0) return;
    for (const [pad, latched] of this.#latched) {
      for (const [button, left] of latched) {
        if (left <= 1) latched.delete(button);
        else latched.set(button, left - 1);
      }
      if (latched.size === 0) this.#latched.delete(pad);
    }
    this.#publish();
  }

  /** Every pad reads as gone, for when the bridge stops. */
  clear(): void {
    this.#pads.clear();
    this.#latched.clear();
    this.#active.clear();
    this.#publish();
  }

  /** The pads as `navigator.getGamepads()` reports them: always the same array and the same objects. */
  snapshot(): readonly (ShimPad | null)[] {
    return this.#out;
  }

  /** True while the slot's pad is connected and shown (Steam's virtual pad hides once a pad of the player's own is used). */
  shows(index: number): boolean {
    return this.#out[index]?.connected === true;
  }

  /** One pad as the browser would hand it to a `gamepadconnected` / `gamepaddisconnected` event. */
  eventPad(index: number): ShimPad | null {
    return this.#out[index] ?? null;
  }

  /** Writes every slot's object from the pads, latches and the Steam rule. */
  #publish(): void {
    const ownPadActive = [...this.#pads.values()].some(
      (pad) => !isSteamVirtualPad(pad.id) && this.#active.has(pad.index),
    );
    for (let index = 0; index < SLOTS; index++) {
      const pad = this.#pads.get(index);
      const shown = pad !== undefined && !(ownPadActive && isSteamVirtualPad(pad.id));
      const slot = this.#out[index];
      if (!pad) {
        if (slot) release(slot);
        continue;
      }
      const target = slot ?? (this.#out[index] = newSlot(pad));
      target.id = pad.id;
      target.index = index;
      target.timestamp = pad.timestamp;
      if (!shown) {
        release(target);
        continue;
      }
      target.connected = true;
      const latched = this.#latched.get(index);
      pad.buttons.forEach((button, i) => {
        const tapped = !button.pressed && latched?.has(i) === true;
        const out = target.buttons[i] ?? (target.buttons[i] = { pressed: false, value: 0, touched: false });
        out.pressed = button.pressed || tapped;
        out.value = tapped ? 1 : button.value;
        out.touched = out.pressed;
      });
      target.buttons.length = pad.buttons.length;
      pad.axes.forEach((value, i) => (target.axes[i] = value));
      target.axes.length = pad.axes.length;
    }
  }
}

function newSlot(pad: BridgePad): SlotPad {
  return {
    id: pad.id,
    index: pad.index,
    connected: false,
    mapping: "standard",
    timestamp: pad.timestamp,
    axes: pad.axes.map(() => 0),
    buttons: pad.buttons.map(() => ({ pressed: false, value: 0, touched: false })),
  };
}

/** A pad that left (or is hidden): disconnected, every button up and every stick centred. */
function release(slot: SlotPad): void {
  slot.connected = false;
  for (const button of slot.buttons) {
    button.pressed = false;
    button.value = 0;
    button.touched = false;
  }
  slot.axes.fill(0);
}
