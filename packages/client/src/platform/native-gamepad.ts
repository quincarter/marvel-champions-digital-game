/**
 * Controllers read natively by the desktop app on Linux, in place of the webview's Gamepad API.
 *
 * WebKitGTK reported an 8BitDo Ultimate 2 with a trigger posing as a stick axis (always pushed), a dead D-pad, and
 * presses that only landed when held (Bazzite, 2026-10-24). On Linux the app reads controllers itself
 * (`src-tauri/src/gamepad_bridge.rs`, gilrs and SDL's controller database) and pushes each change as an `mc-gamepad`
 * event. Here `navigator.getGamepads()` is replaced with those pads in the standard layout (`view/native-pads.ts`),
 * so Phaser, the input bindings, the toast and the Controls screen read them unchanged, and the webview's own
 * connect and disconnect events are held back in favour of the bridge's. If the bridge stops (`stopped`), the
 * webview's own pads come back.
 *
 * Nothing runs in a browser, on Windows or macOS (the command answers `enabled: false` there), or before the bridge
 * says it is up. The main thread's share is one small event per change, at most about 120 a second while a stick moves,
 * and one check per game step while a tap is being held down for the game to see.
 */
import Phaser from "phaser";
import { isDeliberatePadInput, NativePads, type BridgeMessage, type BridgePad } from "../view/native-pads.js";
import { padIdentityOf } from "../view/pad-family.js";
import { notePadInput } from "./input-device.js";
import { detectPlatform } from "./platform.js";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** Marks the connect and disconnect events this module sends, so the webview's own can be told apart and held back. */
const NATIVE = Symbol.for("mc.nativeGamepad");

let started = false;

export function startNativeGamepad(game: Phaser.Game): void {
  if (started || detectPlatform() !== "tauri") return;
  started = true;
  void begin(game);
}

async function begin(game: Phaser.Game): Promise<void> {
  let invoke: Invoke;
  let listen: typeof import("@tauri-apps/api/event").listen;
  try {
    ({ invoke } = (await import("@tauri-apps/api/core")) as { invoke: Invoke });
    ({ listen } = await import("@tauri-apps/api/event"));
  } catch {
    return;
  }

  const pads = new NativePads();
  let live = false;
  const announce = (kind: "connected" | "disconnected", index: number): void => {
    const pad = pads.eventPad(index);
    if (!pad) return;
    const event = new Event(kind === "disconnected" ? "gamepaddisconnected" : "gamepadconnected");
    Object.defineProperty(event, "gamepad", { value: pad });
    Object.defineProperty(event, NATIVE, { value: true });
    window.dispatchEvent(event);
  };
  // The webview's own events would announce its misread pads: only the bridge's get through. On the window itself
  // the capture listener runs before Phaser's and the toast's.
  const holdBack = (event: Event): void => {
    if (!(NATIVE in event)) event.stopImmediatePropagation();
  };
  // A tap stays down for a step or two (`NativePads#endStep`), counted in the game's own steps: under a frame-rate cap
  // the browser draws frames the game skips, and counting those would let a tap expire unseen.
  const countStep = (): void => pads.endStep();
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads");

  let stop = (): void => {};
  // Listening starts before the bridge does: it announces the pads already plugged in as soon as its thread is up.
  const known = new Set<number>();
  const unlisten = await listen<BridgeMessage>("mc-gamepad", ({ payload }) => {
    if (payload.kind === "stopped") {
      stop();
      return;
    }
    const changed = pads.apply(payload);
    const pad: BridgePad = payload.pad;
    // The bridge's own presses switch the glyphs to the pad's, whether or not the game's gamepad plugin has seen them.
    if (isDeliberatePadInput(pad)) notePadInput(padIdentityOf(pad.id));
    if (payload.kind === "disconnected" || !pad.connected) known.delete(pad.index);
    else known.add(pad.index);
    if (live && changed && payload.kind !== "state")
      announce(payload.kind === "disconnected" || !pad.connected ? "disconnected" : "connected", pad.index);
  });

  let enabled = false;
  try {
    enabled = (await invoke<{ readonly enabled: boolean }>("gamepad_bridge_status")).enabled;
  } catch {
    enabled = false;
  }
  if (!enabled) {
    unlisten();
    return;
  }

  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => pads.snapshot() });
  window.addEventListener("gamepadconnected", holdBack, { capture: true });
  window.addEventListener("gamepaddisconnected", holdBack, { capture: true });
  game.events.on(Phaser.Core.Events.POST_STEP, countStep);
  live = true;
  for (const index of known) announce("connected", index);

  // The bridge's thread ended: every native pad reads as gone, and the webview's own pads come back.
  stop = (): void => {
    if (!live) return;
    live = false;
    unlisten();
    pads.clear();
    game.events.off(Phaser.Core.Events.POST_STEP, countStep);
    window.removeEventListener("gamepadconnected", holdBack, { capture: true });
    window.removeEventListener("gamepaddisconnected", holdBack, { capture: true });
    if (original) Object.defineProperty(navigator, "getGamepads", original);
    else delete (navigator as { getGamepads?: unknown }).getGamepads;
  };
}
