/**
 * The board's keyboard shortcuts that are not already a `GamepadIntent` (`view/input-shortcuts.ts` names them all).
 *
 * Pure so the table of keys is tested without a canvas: which keys mean what, and which presses are left alone (a
 * chord with Ctrl, Cmd or Alt is the browser's: Ctrl+R reloads, Ctrl+F finds).
 */

import type { BasicAction } from "./highlights.js";

export type BoardShortcut =
  | { readonly kind: "basic"; readonly action: Exclude<BasicAction, "endTurn"> }
  | { readonly kind: "endTurn" }
  | { readonly kind: "zone"; readonly step: 1 | -1 }
  | { readonly kind: "log" };

export interface KeyPress {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

const LETTERS: Readonly<Record<string, BoardShortcut>> = {
  a: { kind: "basic", action: "attack" },
  h: { kind: "basic", action: "thwart" },
  r: { kind: "basic", action: "recover" },
  f: { kind: "basic", action: "changeForm" },
  l: { kind: "log" },
};

/** What a key press means on the board, or null. Plain Enter is "activate" (`bindKeyboard`), so only Shift+Enter is here. */
export function boardShortcutOf(press: KeyPress): BoardShortcut | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  if (press.key === "Enter") return press.shiftKey ? { kind: "endTurn" } : null;
  if (press.key === "[") return { kind: "zone", step: -1 };
  if (press.key === "]") return { kind: "zone", step: 1 };
  // Shift+A is not Attack: a held Shift is a different chord (Shift+Tab, Shift+Enter) and stays unclaimed here.
  if (press.shiftKey) return null;
  return LETTERS[press.key.toLowerCase()] ?? null;
}
