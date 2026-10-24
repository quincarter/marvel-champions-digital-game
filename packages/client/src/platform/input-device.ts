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
import type { PadIdentity } from "../view/pad-family.js";

type Listener = (state: InputModeState) => void;

let state: InputModeState = INITIAL_INPUT_MODE;
const listeners = new Set<Listener>();
let restTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function dispatch(event: InputEvent): void {
  const next = nextInputMode(state, event);
  if (next === state) return;
  const changed = next.mode !== state.mode || next.pad !== state.pad || next.mouseMoving !== state.mouseMoving;
  state = next;
  if (changed) for (const listener of listeners) listener(state);
}

export function inputDevice(): InputModeState {
  return state;
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
  target.addEventListener("keydown", () => dispatch({ kind: "key" }), { capture: true });
  target.addEventListener(
    "pointermove",
    (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
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
