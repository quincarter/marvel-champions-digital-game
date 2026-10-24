/**
 * Gamepad buttons, as the same intents the keyboard already produces.
 *
 * PLAN.md Phase 4 accessibility: "full keyboard and gamepad navigation with a
 * visible focus ring" — `focus.ts` is the one input-agnostic route; this module
 * is the other half of "input-agnostic", answering "what does this button
 * mean" as a pure, data-driven table rather than a scene `switch`, so the
 * mapping is testable without a canvas or an actual controller attached. The
 * scene's job (`scenes/board/input.ts#bindGamepad`) is only to translate a button
 * index the browser handed it into one of these intents and hand it to the
 * same `onIntent` the keyboard binding already calls — nothing about
 * focus order, targeting or dispatch lives here or there.
 */

import type { FocusDirection } from "./spatial-nav.js";

/**
 * What the keyboard binding already distinguishes (`scenes/board/input.ts#bindKeyboard`).
 *
 * `pageNext`/`pagePrevious`/`home`/`end` are for a scrolling list
 * (`ui/virtual-list.ts`): most screens have no list and simply never wire
 * `FocusRouteOptions.onPage`/`onHomeEnd`, so these intents fall through as a
 * no-op there — the same "just don't wire it" shape `inspect` already has on
 * a screen with nothing to read.
 */
export type GamepadIntent =
  /** Tab / Shift+Tab: the screen's stated route, in order. */
  | "next"
  | "previous"
  /** The arrow keys and the D-pad: the nearest stop that way on screen (`view/spatial-nav.ts`, issue #206). */
  | "up"
  | "down"
  | "left"
  | "right"
  | "activate"
  | "inspect"
  | "cancel"
  | "pageNext"
  | "pagePrevious"
  | "home"
  | "end"
  /** Moves keyboard/pad focus into the guide surface (the rail/callout, the villain-phase/defend guide strip, or
   * an opportunistic tip toast) and back out to the board — guided mode's own accessibility gap fix
   * (`docs/guided-mode.md` §3.10, §7). A screen with no guide surface simply never wires this. */
  | "toggleGuide"
  /** LT and RT: the board's Undo and End turn (`docs/controller-support.md`). Other screens leave them unwired. */
  | "undo"
  | "endTurn"
  /** Menu / Start / +: Pause, from anywhere a game is open. */
  | "pause"
  /** View / Select / −: the board's game log; on a decision popup, Peek at table. */
  | "view"
  /** The right stick's press (R3): Expand / Collapse a decision popup. */
  | "expand";

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
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  view: 8,
  menu: 9,
  l3: 10,
  r3: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  /** The pad's own home / guide / PS button. Browsers often keep it for themselves; never bound. */
  home: 16,
} as const;

/** The standard layout's stick axes: left stick X/Y, right stick X/Y, each -1 (left/up) to 1 (right/down). */
export const GAMEPAD_AXIS = { leftX: 0, leftY: 1, rightX: 2, rightY: 3 } as const;

const INTENT_BY_BUTTON: Readonly<Record<number, GamepadIntent>> = {
  // The D-pad moves the way it points, like the arrow keys (issue #206); it used to walk the route like Tab.
  [GAMEPAD_BUTTON.dpadRight]: "right",
  [GAMEPAD_BUTTON.dpadDown]: "down",
  [GAMEPAD_BUTTON.dpadLeft]: "left",
  [GAMEPAD_BUTTON.dpadUp]: "up",
  // A is the face button in the position a controller's own "confirm" always
  // sits, the same reasoning that makes Enter/Space the keyboard's activate.
  [GAMEPAD_BUTTON.a]: "activate",
  // Y sits opposite A on every standard pad, which is where "look closer"
  // (Inspect) belongs rather than crowding it onto the confirm button.
  [GAMEPAD_BUTTON.y]: "inspect",
  // B is the pad's universal "back" — Escape's equivalent.
  [GAMEPAD_BUTTON.b]: "cancel",
  // The shoulder buttons are a scrolling list's Page Up/Down on every pad
  // that has a browser/menu convention (a game console's own "next tab").
  [GAMEPAD_BUTTON.l1]: "pagePrevious",
  [GAMEPAD_BUTTON.r1]: "pageNext",
  // X was the one face button with no meaning on this board yet — used here as the guide's own focus-region
  // toggle (mirrors the keyboard's "G"), rather than crowding it onto A/B/Y.
  [GAMEPAD_BUTTON.x]: "toggleGuide",
  [GAMEPAD_BUTTON.l2]: "undo",
  [GAMEPAD_BUTTON.r2]: "endTurn",
  [GAMEPAD_BUTTON.menu]: "pause",
  [GAMEPAD_BUTTON.view]: "view",
  [GAMEPAD_BUTTON.r3]: "expand",
};

/**
 * The button bound to an intent, for drawing its glyph: the first standard-layout index whose intent it is, or null
 * when no button means it. Indices are before any Switch-layout swap (`view/pad-family.ts#physicalIndexOf`).
 */
export function gamepadButtonFor(intent: GamepadIntent): number | null {
  for (const [index, bound] of Object.entries(INTENT_BY_BUTTON)) if (bound === intent) return Number(index);
  return null;
}

/** The intent one button press means, or `null` for a button this board doesn't use. */
export function gamepadIntentFor(buttonIndex: number): GamepadIntent | null {
  return INTENT_BY_BUTTON[buttonIndex] ?? null;
}

/** The direction an arrow or D-pad intent points, or null for every other intent. */
export function directionOf(intent: GamepadIntent): FocusDirection | null {
  return intent === "up" || intent === "down" || intent === "left" || intent === "right" ? intent : null;
}

/**
 * The route step a direction falls back to on a surface with no on-screen layout to move through (Inspect's ◂ ▸
 * card stepper): Right and Down are "next", Left and Up are "previous". Every other intent is returned as it is.
 */
export function linearIntent(intent: GamepadIntent): GamepadIntent {
  if (intent === "right" || intent === "down") return "next";
  if (intent === "left" || intent === "up") return "previous";
  return intent;
}
