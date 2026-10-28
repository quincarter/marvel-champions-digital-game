/**
 * The app-wide "which input is in use" store behind the key and button glyphs (`view/input-mode.ts` holds the rules).
 *
 * The keyboard, mouse and touch are read from window events here; the controller is reported by the gamepad binding
 * (`scenes/board/input.ts#bindGamepad`), which already sees every button and stick, through `notePadInput`.
 */

import {
  INITIAL_INPUT_MODE,
  MOUSE_REST_MS,
  nextInputMode,
  type InputEvent,
  type InputModeState,
} from "../view/input-mode.js";
import { PadModeTracker } from "../view/pad-filters.js";
import type { PadIdentity } from "../view/pad-family.js";
import { isPlatformBack } from "./back-gesture.js";

type Listener = (state: InputModeState) => void;

let state: InputModeState = INITIAL_INPUT_MODE;
const padTracker = new PadModeTracker();
const listeners = new Set<Listener>();
let restTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;
let lastMouse: { x: number; y: number } | null = null;

let notifyQueued = false;

function dispatch(event: InputEvent): void {
  const next = nextInputMode(state, event);
  if (next === state) return;
  const changed = next.mode !== state.mode || next.pad !== state.pad || next.mouseMoving !== state.mouseMoving;
  state = next;
  padTracker.note(event.kind);
  if (changed) queueNotify();
}

/**
 * Listeners hear about a change after the event that caused it has been handled, never from inside it. The window's
 * capture listeners run before Phaser sees the same press, and a listener that redraws there (a glyph swap on the
 * first touch after the mouse) destroyed the very zones the press was about to land on. Changes in one turn coalesce.
 */
function queueNotify(): void {
  if (notifyQueued) return;
  notifyQueued = true;
  setTimeout(() => {
    notifyQueued = false;
    for (const listener of [...listeners]) listener(state);
  }, 0);
}

export function inputDevice(): InputModeState {
  return state;
}

/** Whether the last real input was the controller's (a mouse move does not end it; a key or a touch does). */
export function padInputTracked(): boolean {
  return padTracker.active;
}

/** Called on every change of mode, pad or mouse movement. Returns the unsubscribe. */
export function onInputDeviceChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Any controller input: a button, the D-pad, or a stick moved past its deadzone. */
export function notePadInput(pad: PadIdentity): void {
  dispatch({ kind: "pad", pad });
}

/** Binds the window's keyboard and pointer events. Called once from `main.ts`; a second call is a no-op. */
export function installInputDeviceTracking(target: Window = window): void {
  if (installed) return;
  installed = true;
  // The Escape a phone's back gesture sends is not the keyboard coming into use: the touch glyphs stay.
  target.addEventListener("keydown", (event) => !isPlatformBack(event) && dispatch({ kind: "key" }), {
    capture: true,
  });
  target.addEventListener(
    "pointermove",
    (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      // A pointermove the cursor did not make (the webview re-sends one when the page changes under a resting cursor,
      // and a TV's remote or Steam's desktop layout can nudge by a pixel) must not end the pad's glyphs.
      const moved = lastMouse === null || Math.hypot(event.clientX - lastMouse.x, event.clientY - lastMouse.y) >= 3;
      if (!moved) return;
      lastMouse = { x: event.clientX, y: event.clientY };
      dispatch({ kind: "mouseMove" });
      if (restTimer !== null) clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        restTimer = null;
        dispatch({ kind: "mouseRest" });
      }, MOUSE_REST_MS);
    },
    { capture: true, passive: true },
  );
  target.addEventListener(
    "pointerdown",
    (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") dispatch({ kind: "touch" });
    },
    { capture: true, passive: true },
  );
}

/** Tests only: back to no input seen. */
export function resetInputDeviceForTests(): void {
  state = INITIAL_INPUT_MODE;
  padTracker.reset();
  listeners.clear();
}

/** True when a gamepad is connected right now, or one has been used this session. */
export function padAvailable(
  nav: { getGamepads?: () => (Gamepad | null)[] } | undefined = globalThis.navigator,
): boolean {
  if (state.pad !== null) return true;
  try {
    return (nav?.getGamepads?.() ?? []).some((pad) => pad?.connected === true);
  } catch {
    return false;
  }
}
