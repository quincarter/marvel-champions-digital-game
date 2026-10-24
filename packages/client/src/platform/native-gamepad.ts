/**
 * Controllers read natively by the desktop app on Linux, in place of the webview's Gamepad API.
 *
 * WebKitGTK reported an 8BitDo Ultimate 2 with a trigger posing as a stick axis (always pushed), a dead D-pad, and
 * presses that only landed when held (Bazzite, 2026-10-24). On Linux the app reads controllers itself
 * (`src-tauri/src/gamepad_bridge.rs`, gilrs and SDL's controller database) and pushes each change as an `mc-gamepad`
 * event. Here `navigator.getGamepads()` is replaced with those pads in the standard layout (`view/native-pads.ts`),
 * so Phaser, the input bindings, the toast and the Controls screen read them unchanged, and the webview's own
 * connect and disconnect events are held back in favour of the bridge's.
 *
 * Nothing runs in a browser, on Windows or macOS (the command answers `enabled: false` there), or before the bridge
 * says it is up. The main thread's share is one small event per change, at most about 120 a second while a stick moves.
 */
import { NativePads, type BridgeMessage } from "../view/native-pads.js";
import { detectPlatform } from "./platform.js";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** Marks the connect and disconnect events this module sends, so the webview's own can be told apart and held back. */
const NATIVE = Symbol.for("mc.nativeGamepad");

let started = false;

export function startNativeGamepad(): void {
  if (started || detectPlatform() !== "tauri") return;
  started = true;
  void begin();
}

async function begin(): Promise<void> {
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
  const announce = (kind: BridgeMessage["kind"], pad: BridgeMessage["pad"]): void => {
    const event = new Event(kind === "disconnected" ? "gamepaddisconnected" : "gamepadconnected");
    Object.defineProperty(event, "gamepad", { value: pads.eventPad(pad) });
    Object.defineProperty(event, NATIVE, { value: true });
    window.dispatchEvent(event);
  };
  // A tap stays down for a frame or two (`NativePads#endFrame`); the frames are counted only while one is held.
  let counting = false;
  const countFrame = (): void => {
    pads.endFrame();
    if (pads.latching) requestAnimationFrame(countFrame);
    else counting = false;
  };
  // Listening starts before the bridge does: it announces the pads already plugged in as soon as its thread is up.
  const known = new Map<number, BridgeMessage["pad"]>();
  const unlisten = await listen<BridgeMessage>("mc-gamepad", ({ payload }) => {
    const changed = pads.apply(payload);
    if (payload.kind === "disconnected") known.delete(payload.pad.index);
    else known.set(payload.pad.index, payload.pad);
    if (!live) return;
    if (pads.latching && !counting) {
      counting = true;
      requestAnimationFrame(countFrame);
    }
    if (changed && payload.kind !== "state") announce(payload.kind, payload.pad);
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
  // The webview's own events would announce its misread pads: only the bridge's get through. On the window itself
  // the capture listener runs before Phaser's and the toast's.
  const holdBack = (event: Event): void => {
    if (!(NATIVE in event)) event.stopImmediatePropagation();
  };
  window.addEventListener("gamepadconnected", holdBack, { capture: true });
  window.addEventListener("gamepaddisconnected", holdBack, { capture: true });
  live = true;
  for (const pad of known.values()) announce("connected", pad);
}
