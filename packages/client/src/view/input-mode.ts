/**
 * Which input the player is using right now, for the key and button glyphs (`docs/controller-support.md`).
 *
 * The owner's rules (2026-10-24): glyphs show only while a keyboard or a controller is in use, never for touch. The
 * mouse counts as the keyboard's side, so moving it brings the keyboard glyphs back; any controller input (a button,
 * the D-pad, a stick wiggle) switches them to the controller's. While the mouse is moving the glyphs collapse, and
 * they expand again once it rests. Pure, so the rules are tested without a browser; `platform/input-device.ts` feeds it.
 */

import type { PadIdentity } from "./pad-family.js";

export type InputMode = "keyboard" | "pad" | "touch";

export interface InputModeState {
  /** The last input's kind, or null before any input. */
  readonly mode: InputMode | null;
  /** The pad last pressed or moved, kept after the player goes back to the keyboard so its glyphs are ready. */
  readonly pad: PadIdentity | null;
  /** The mouse moved within the last `MOUSE_REST_MS`. */
  readonly mouseMoving: boolean;
}

export const INITIAL_INPUT_MODE: InputModeState = { mode: null, pad: null, mouseMoving: false };

/** How long the mouse must rest before the collapsed glyphs expand again. */
export const MOUSE_REST_MS = 600;

export type InputEvent =
  | { readonly kind: "key" }
  | { readonly kind: "mouseMove" }
  | { readonly kind: "mouseRest" }
  | { readonly kind: "touch" }
  | { readonly kind: "pad"; readonly pad: PadIdentity };

export function nextInputMode(state: InputModeState, event: InputEvent): InputModeState {
  switch (event.kind) {
    case "key":
      return { ...state, mode: "keyboard", mouseMoving: false };
    case "mouseMove":
      return { ...state, mode: "keyboard", mouseMoving: true };
    case "mouseRest":
      return state.mouseMoving ? { ...state, mouseMoving: false } : state;
    case "touch":
      return { ...state, mode: "touch", mouseMoving: false };
    case "pad":
      return { ...state, mode: "pad", pad: event.pad, mouseMoving: false };
  }
}

/** Which glyph set to draw, or null for none: the setting is off, there's been no keyboard or pad input, or touch. */
export function glyphSetOf(state: InputModeState, glyphsOn: boolean): "keyboard" | "pad" | null {
  if (!glyphsOn) return null;
  return state.mode === "keyboard" || state.mode === "pad" ? state.mode : null;
}

/** Whether the glyphs are drawn expanded (true) or collapsed while the mouse moves (false). */
export function glyphsExpanded(state: InputModeState): boolean {
  return !state.mouseMoving;
}
