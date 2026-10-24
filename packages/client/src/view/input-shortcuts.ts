/**
 * Every shortcut the game has, by what it does: the key caps that trigger it and the pad intent that does.
 *
 * One table so the glyph hints, the Controls screen and the key handlers can't drift apart. The keyboard handlers
 * (`scenes/board/input.ts#bindKeyboard`, `scenes/board.ts`) read `event.key`; this names the same keys for display.
 * The pad button for a shortcut is whatever `view/gamepad.ts#gamepadButtonFor` says is bound to its intent, so a
 * later remap moves the glyph with it.
 */

import type { GamepadIntent } from "./gamepad.js";

export type ShortcutId =
  | "activate"
  | "cancel"
  | "inspect"
  | "guide"
  | "attack"
  | "thwart"
  | "recover"
  | "changeForm"
  | "endTurn"
  | "undo"
  | "pause"
  | "log"
  | "zonePrevious"
  | "zoneNext"
  | "peek"
  | "expand"
  | "teamUp"
  | "evidence";

export interface Shortcut {
  readonly id: ShortcutId;
  /** Key caps as drawn, one chord: ["Shift", "Enter"]. Empty when the keyboard has no key for it. */
  readonly keys: readonly string[];
  /** The pad intent that does the same, or null when only the keyboard has it. */
  readonly padIntent: GamepadIntent | null;
  /** What it does, for the Controls screen. */
  readonly label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "activate", keys: ["Enter"], padIntent: "activate", label: "Select / play the focused card" },
  { id: "cancel", keys: ["Esc"], padIntent: "cancel", label: "Back / cancel" },
  { id: "inspect", keys: ["I"], padIntent: "inspect", label: "Inspect the focused card" },
  { id: "guide", keys: ["G"], padIntent: "toggleGuide", label: "Move focus to the guide" },
  { id: "attack", keys: ["A"], padIntent: null, label: "Attack" },
  { id: "thwart", keys: ["H"], padIntent: null, label: "Thwart" },
  { id: "recover", keys: ["R"], padIntent: null, label: "Recover" },
  { id: "changeForm", keys: ["F"], padIntent: null, label: "Change form" },
  { id: "endTurn", keys: ["Shift", "Enter"], padIntent: "endTurn", label: "End turn" },
  { id: "undo", keys: ["Z"], padIntent: "undo", label: "Undo" },
  { id: "pause", keys: ["Esc"], padIntent: "pause", label: "Pause" },
  { id: "log", keys: ["L"], padIntent: "view", label: "Game log" },
  { id: "zonePrevious", keys: ["["], padIntent: "pagePrevious", label: "Previous zone" },
  { id: "zoneNext", keys: ["]"], padIntent: "pageNext", label: "Next zone" },
  { id: "peek", keys: ["P"], padIntent: "view", label: "Peek at table (decision popup)" },
  { id: "expand", keys: ["X"], padIntent: "expand", label: "Expand / collapse a decision popup" },
  { id: "teamUp", keys: ["T"], padIntent: null, label: "Team-Up" },
  { id: "evidence", keys: ["E"], padIntent: null, label: "Evidence" },
];

const BY_ID: ReadonlyMap<ShortcutId, Shortcut> = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export function shortcutOf(id: ShortcutId): Shortcut {
  return BY_ID.get(id)!;
}
