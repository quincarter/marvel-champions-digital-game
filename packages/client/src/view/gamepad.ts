/**
 * Gamepad buttons, as the same intents the keyboard already produces.
 *
 * PLAN.md Phase 4 accessibility: "full keyboard and gamepad navigation with a
 * visible focus ring" — `focus.ts` is the one input-agnostic route; this module
 * is the other half of "input-agnostic", answering "what does this button
 * mean" as a pure, data-driven table rather than a scene `switch`, so the
 * mapping is testable without a canvas or an actual controller attached. The
 * scene's job (`scenes/board.ts#bindGamepad`) is only to translate a button
 * index the browser handed it into one of these intents and hand it to the
 * same `#actOnIntent` the keyboard binding already calls — nothing about
 * focus order, targeting or dispatch lives here or there.
 */

/** What the keyboard binding already distinguishes (`scenes/board.ts#bindKeys`). */
export type GamepadIntent = "next" | "previous" | "activate" | "inspect" | "cancel";

/**
 * Indices from the Web Gamepad API's "standard" layout, which browsers map
 * the overwhelming majority of controllers onto and which Phaser's own
 * `Input.Gamepad.Configs.XBOX_360` numbering matches: face buttons 0-3,
 * D-pad 12-15. A controller the browser can't normalize to "standard" (rare)
 * simply doesn't navigate the board, the same way an unrecognized keyboard
 * layout wouldn't.
 */
export const GAMEPAD_BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

const INTENT_BY_BUTTON: Readonly<Record<number, GamepadIntent>> = {
  [GAMEPAD_BUTTON.dpadRight]: "next",
  [GAMEPAD_BUTTON.dpadDown]: "next",
  [GAMEPAD_BUTTON.dpadLeft]: "previous",
  [GAMEPAD_BUTTON.dpadUp]: "previous",
  // A is the face button in the position a controller's own "confirm" always
  // sits, the same reasoning that makes Enter/Space the keyboard's activate.
  [GAMEPAD_BUTTON.a]: "activate",
  // Y sits opposite A on every standard pad, which is where "look closer"
  // (Inspect) belongs rather than crowding it onto the confirm button.
  [GAMEPAD_BUTTON.y]: "inspect",
  // B is the pad's universal "back" — Escape's equivalent.
  [GAMEPAD_BUTTON.b]: "cancel",
};

/** The intent one button press means, or `null` for a button this board doesn't use. */
export function gamepadIntentFor(buttonIndex: number): GamepadIntent | null {
  return INTENT_BY_BUTTON[buttonIndex] ?? null;
}
