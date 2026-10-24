/**
 * What a keydown means, resolved through the one shortcut table (`view/input-shortcuts.ts`) by physical key
 * (`KeyboardEvent.code`), for the keyboard hand in use (`docs/controller-support.md`, decision 10).
 *
 * Pure so the key map is tested without a canvas: `navIntentOf` is what every screen's `bindKeyboard` forwards (the
 * same `GamepadIntent`s the pad sends), `boardKeyActionOf` is what only the Board adds (basic actions, End turn, Undo,
 * zones, log, Team-Up, Evidence, abilities), `peekExpandOf` is the decision popup's two. A chord with Alt is the
 * browser's and never a shortcut; Ctrl / Cmd and Shift must match the table exactly, so Shift+Enter is End turn and
 * never Select, and Ctrl+R stays a reload.
 */

import type { GamepadIntent } from "./gamepad.js";
import { shortcutsFor, type KeyboardHand, type ShortcutId } from "./input-shortcuts.js";
import type { BasicAction } from "./highlights.js";

/** The parts of a `KeyboardEvent` the map reads. */
export interface KeyEventLike {
  readonly code: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly repeat?: boolean;
}

const MOVES: Readonly<Partial<Record<ShortcutId, GamepadIntent>>> = {
  moveUp: "up",
  moveDown: "down",
  moveLeft: "left",
  moveRight: "right",
};

/** Keys that are not hand-aware: Tab walks the route, the page keys page. */
const FIXED: Readonly<Record<string, GamepadIntent>> = {
  PageDown: "pageNext",
  PageUp: "pagePrevious",
  Home: "home",
  End: "end",
};

/** The intent a key sends on every screen, or null. */
export function navIntentOf(event: KeyEventLike, hand: KeyboardHand): GamepadIntent | null {
  if (event.altKey === true) return null;
  const mod = event.ctrlKey || event.metaKey === true;
  if (event.code === "Tab") return mod ? null : event.shiftKey ? "previous" : "next";
  if (!mod && !event.shiftKey) {
    const fixed = FIXED[event.code];
    if (fixed) return fixed;
  }
  const ids = shortcutsFor(event, hand);
  for (const id of ids) {
    const move = MOVES[id];
    if (move) return move;
  }
  if (ids.includes("activate")) return "activate";
  if (ids.includes("cancel")) return "cancel";
  if (ids.includes("inspect")) return "inspect";
  if (ids.includes("guide")) return "toggleGuide";
  return null;
}

export type BoardKeyAction =
  | { readonly kind: "basic"; readonly action: Exclude<BasicAction, "endTurn"> }
  | { readonly kind: "endTurn" }
  | { readonly kind: "undo" }
  | { readonly kind: "zone"; readonly step: 1 | -1 }
  | { readonly kind: "log" }
  | { readonly kind: "teamUp" }
  | { readonly kind: "evidence" }
  /** The `slot`th (0-based) usable ability on your cards in play (`view/ability-slots.ts`). */
  | { readonly kind: "ability"; readonly slot: 0 | 1 | 2 | 3 };

const BOARD_IDS: Readonly<Partial<Record<ShortcutId, BoardKeyAction>>> = {
  // Zones first: R/F are zones on the Board and Peek / Expand on the decision popup (the Board is blocked then).
  zoneUp: { kind: "zone", step: -1 },
  zoneDown: { kind: "zone", step: 1 },
  attack: { kind: "basic", action: "attack" },
  thwart: { kind: "basic", action: "thwart" },
  recover: { kind: "basic", action: "recover" },
  changeForm: { kind: "basic", action: "changeForm" },
  endTurn: { kind: "endTurn" },
  undo: { kind: "undo" },
  log: { kind: "log" },
  teamUp: { kind: "teamUp" },
  evidence: { kind: "evidence" },
  ability1: { kind: "ability", slot: 0 },
  ability2: { kind: "ability", slot: 1 },
  ability3: { kind: "ability", slot: 2 },
  ability4: { kind: "ability", slot: 3 },
};

/**
 * What a key does on the Board beyond navigation, or null. A held key repeats and only the zone jumps are meant to
 * (a held Shift+Enter would end the next turn too, a held Ctrl+Z undo the whole turn), so a repeat is null for the rest.
 */
export function boardKeyActionOf(event: KeyEventLike, hand: KeyboardHand): BoardKeyAction | null {
  if (event.altKey === true) return null;
  for (const id of shortcutsFor(event, hand)) {
    const action = BOARD_IDS[id];
    if (!action) continue;
    if (event.repeat === true && action.kind !== "zone") return null;
    return action;
  }
  return null;
}

/**
 * Which answer (0 to 2) a key gives a small choice bar ("Which one?", "Thwart with?", "Where does it go?"): the digits
 * 1 to 3, and under the right hand also its own ability digits 7 to 9, so the bar answers from either hand.
 */
export function choiceSlotOf(event: KeyEventLike, hand: KeyboardHand): 0 | 1 | 2 | null {
  if (event.altKey === true || event.repeat === true) return null;
  const ids = shortcutsFor(event, hand);
  for (const [index, id] of (["ability1", "ability2", "ability3"] as const).entries()) {
    if (ids.includes(id)) return index as 0 | 1 | 2;
  }
  if (!event.shiftKey && !event.ctrlKey && event.metaKey !== true) {
    if (event.code === "Digit1") return 0;
    if (event.code === "Digit2") return 1;
    if (event.code === "Digit3") return 2;
  }
  return null;
}

/** The decision popup's two keys (View and R3's): Peek at table and Expand / Collapse. */
export function peekExpandOf(event: KeyEventLike, hand: KeyboardHand): "peek" | "expand" | null {
  if (event.altKey === true) return null;
  const ids = shortcutsFor(event, hand);
  if (ids.includes("peek")) return "peek";
  if (ids.includes("expand")) return "expand";
  return null;
}

/** True for an element that takes typed text, so a letter in it is a letter and never a shortcut. */
export function isTextEntry(
  element: { readonly tagName?: string; readonly isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!element) return false;
  const tag = element.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true;
}

/** True while a DOM text field (`McTextInput`'s input) has focus, or is where the key event came from. */
export function typingInTextField(event?: { readonly target?: unknown }): boolean {
  if (event?.target && isTextEntry(event.target as { tagName?: string })) return true;
  const doc = (globalThis as { document?: { activeElement?: unknown } }).document;
  return isTextEntry(doc?.activeElement as { tagName?: string } | null | undefined);
}
