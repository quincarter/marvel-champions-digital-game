/**
 * Every shortcut the game has, by what it does: the keys that trigger it (for each keyboard hand) and the pad intent
 * that does.
 *
 * One table so the glyph hints, the Controls screen and the key handlers can't drift apart. The keyboard is one-handed
 * (`docs/controller-support.md` decision 10): the left-hand map sits under WASD and the right-hand map mirrors it under
 * IJKL for a mouse in the left hand. Arrows, Enter and Esc work under both.
 *
 * **Matching keys (for the handlers).** A chord matches on `KeyboardEvent.code`, the physical position: `KeyQ`,
 * `Digit1`, `Comma`, `Space`, `Enter`, `Escape`, `ArrowUp`. Positions keep the map in the same place on AZERTY and
 * other layouts, where `event.key` would move WASD away from the left hand. (The older handlers read `event.key`; the
 * phase that wires this table replaces that.) `caps` is what the glyph draws, QWERTY-labelled. Use `chordMatches`.
 *
 * The pad button for a shortcut is whatever `view/gamepad.ts#gamepadButtonFor` says is bound to its intent, so a
 * later remap moves the glyph with it.
 */

import type { GamepadIntent } from "./gamepad.js";
import { keyLabelOfCode } from "./key-labels.js";

export type KeyboardHand = "left" | "right";
export const KEYBOARD_HAND_VALUES: readonly KeyboardHand[] = ["left", "right"];

export type ShortcutId =
  | "activate"
  | "select"
  | "cancel"
  | "back"
  | "inspect"
  | "guide"
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "attack"
  | "thwart"
  | "recover"
  | "changeForm"
  | "ability1"
  | "ability2"
  | "ability3"
  | "ability4"
  | "endTurn"
  | "undo"
  | "pause"
  | "log"
  /** Reopens the last villain phase recap (the drawer handle's press); `log` is the game log. */
  | "recap"
  | "zoneUp"
  | "zoneDown"
  /** Aliases of `zoneUp` / `zoneDown` (the board's Previous / Next zone). */
  | "zonePrevious"
  | "zoneNext"
  | "peek"
  | "expand"
  | "teamUp"
  | "evidence";

/** One key chord: the caps to draw, and what a keydown must carry to match. */
export interface KeyChord {
  /** The printed key (`KeyboardEvent.key`, lower case) that also matches, for a chord people press by letter: Ctrl+Z. */
  readonly printed?: string;
  /** Caps as drawn, modifier first: ["Shift", "Space"]. */
  readonly caps: readonly string[];
  /** `KeyboardEvent.code` of the main key. */
  readonly code: string;
  readonly shift: boolean;
  /** Ctrl, or Cmd on a Mac. */
  readonly ctrl: boolean;
}

export interface Shortcut {
  readonly id: ShortcutId;
  /** The left hand's primary caps, for a caller that has no hand yet. Prefer `shortcutCaps`. */
  readonly keys: readonly string[];
  /** The pad intent that does the same, or null when only the keyboard has it. */
  readonly padIntent: GamepadIntent | null;
  /** What it does, for the Controls screen. */
  readonly label: string;
}

const CAP_OF_CODE: Readonly<Record<string, string>> = {
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  BracketLeft: "[",
  BracketRight: "]",
};

function capOf(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return CAP_OF_CODE[code] ?? code;
}

/** `chord("KeyE")`, `chord("Space", { shift: true })`, `chord("KeyZ", { ctrl: true })`. */
function chord(
  code: string,
  mods: { readonly shift?: boolean; readonly ctrl?: boolean; readonly printed?: string } = {},
): KeyChord {
  const shift = mods.shift === true;
  const ctrl = mods.ctrl === true;
  return {
    caps: [...(ctrl ? ["Ctrl"] : []), ...(shift ? ["Shift"] : []), capOf(code)],
    code,
    shift,
    ctrl,
    ...(mods.printed ? { printed: mods.printed } : {}),
  };
}

const ARROWS = { moveUp: "ArrowUp", moveDown: "ArrowDown", moveLeft: "ArrowLeft", moveRight: "ArrowRight" } as const;

/** Per hand, the primary chord first, then the chords that work under both hands. */
function bindingsFor(hand: KeyboardHand): Readonly<Record<ShortcutId, readonly KeyChord[]>> {
  const left = hand === "left";
  const select = [chord(left ? "Space" : "Enter"), ...(left ? [chord("Enter")] : [])];
  const back = [chord(left ? "KeyQ" : "KeyU"), chord("Escape")];
  const zoneUp = [chord(left ? "KeyR" : "KeyP"), chord("BracketLeft")];
  const zoneDown = [chord(left ? "KeyF" : "Semicolon"), chord("BracketRight")];
  return {
    activate: select,
    select,
    cancel: back,
    back,
    inspect: [chord(left ? "KeyE" : "KeyO")],
    guide: [chord(left ? "KeyG" : "KeyH")],
    moveUp: [chord(left ? "KeyW" : "KeyI"), chord(ARROWS.moveUp)],
    moveDown: [chord(left ? "KeyS" : "KeyK"), chord(ARROWS.moveDown)],
    moveLeft: [chord(left ? "KeyA" : "KeyJ"), chord(ARROWS.moveLeft)],
    moveRight: [chord(left ? "KeyD" : "KeyL"), chord(ARROWS.moveRight)],
    attack: [chord(left ? "KeyZ" : "KeyM")],
    thwart: [chord(left ? "KeyX" : "Comma")],
    recover: [chord(left ? "KeyC" : "Period")],
    changeForm: [chord(left ? "KeyV" : "Slash")],
    ability1: [chord(left ? "Digit1" : "Digit7")],
    ability2: [chord(left ? "Digit2" : "Digit8")],
    ability3: [chord(left ? "Digit3" : "Digit9")],
    ability4: [chord(left ? "Digit4" : "Digit0")],
    endTurn: left
      ? [chord("Space", { shift: true }), chord("Enter", { shift: true })]
      : [chord("Enter", { shift: true })],
    // By the printed Z as well as the physical key: Ctrl+Z is a letter people press by name, on AZERTY too.
    undo: [chord("KeyZ", { ctrl: true, printed: "z" })],
    pause: [chord("Escape")],
    recap: [chord(left ? "KeyB" : "KeyN")],
    log: [chord(left ? "KeyB" : "KeyN", { shift: true })],
    zoneUp,
    zoneDown,
    zonePrevious: zoneUp,
    zoneNext: zoneDown,
    peek: [chord(left ? "KeyR" : "KeyP")],
    expand: [chord(left ? "KeyF" : "Semicolon")],
    teamUp: [chord(left ? "KeyT" : "KeyY")],
    evidence: [chord(left ? "KeyE" : "KeyO", { shift: true })],
  };
}

const BINDINGS: Readonly<Record<KeyboardHand, Readonly<Record<ShortcutId, readonly KeyChord[]>>>> = {
  left: bindingsFor("left"),
  right: bindingsFor("right"),
};

/** Every chord that triggers a shortcut under this hand, the primary (hand key) first. */
export function shortcutKeys(id: ShortcutId, hand: KeyboardHand): readonly KeyChord[] {
  return BINDINGS[hand][id];
}

/** The caps to draw for a shortcut under this hand: its primary chord. */
export function shortcutCaps(id: ShortcutId, hand: KeyboardHand): readonly string[] {
  const primary = BINDINGS[hand][id][0]!;
  // The main key's cap follows the user's layout where the browser tells us (AZERTY reads Z Q S D, not W A S D).
  // A chord pressed by its printed letter (Ctrl+Z) already says that letter.
  const label = primary.printed ? null : keyLabelOfCode(primary.code);
  if (label === null) return primary.caps;
  return [...primary.caps.slice(0, -1), label];
}

/** True when a keydown (`code`, modifiers) is this chord. Shift and Ctrl/Cmd must match exactly. */
export function chordMatches(
  chordToMatch: KeyChord,
  event: {
    readonly code: string;
    readonly key?: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey?: boolean;
  },
): boolean {
  const keyMatches =
    event.code === chordToMatch.code ||
    (chordToMatch.printed !== undefined && event.key?.toLowerCase() === chordToMatch.printed);
  return (
    keyMatches &&
    event.shiftKey === chordToMatch.shift &&
    (event.ctrlKey || event.metaKey === true) === chordToMatch.ctrl
  );
}

/** The shortcut a keydown means under this hand, or null. Where two shortcuts share a chord (zones and Peek / Expand), the first listed wins; the caller picks by context. */
export function shortcutsFor(
  event: {
    readonly code: string;
    readonly key?: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey?: boolean;
  },
  hand: KeyboardHand,
): readonly ShortcutId[] {
  return (Object.keys(BINDINGS[hand]) as ShortcutId[]).filter((id) =>
    BINDINGS[hand][id].some((candidate) => chordMatches(candidate, event)),
  );
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "activate",
    keys: shortcutCaps("activate", "left"),
    padIntent: "activate",
    label: "Select / play the focused card",
  },
  { id: "select", keys: shortcutCaps("select", "left"), padIntent: "activate", label: "Select" },
  { id: "cancel", keys: shortcutCaps("cancel", "left"), padIntent: "cancel", label: "Back / cancel" },
  { id: "back", keys: shortcutCaps("back", "left"), padIntent: "cancel", label: "Back" },
  { id: "inspect", keys: shortcutCaps("inspect", "left"), padIntent: "inspect", label: "Inspect the focused card" },
  { id: "guide", keys: shortcutCaps("guide", "left"), padIntent: "toggleGuide", label: "Move focus to the guide" },
  { id: "moveUp", keys: shortcutCaps("moveUp", "left"), padIntent: "up", label: "Move up" },
  { id: "moveDown", keys: shortcutCaps("moveDown", "left"), padIntent: "down", label: "Move down" },
  { id: "moveLeft", keys: shortcutCaps("moveLeft", "left"), padIntent: "left", label: "Move left" },
  { id: "moveRight", keys: shortcutCaps("moveRight", "left"), padIntent: "right", label: "Move right" },
  { id: "attack", keys: shortcutCaps("attack", "left"), padIntent: null, label: "Attack" },
  { id: "thwart", keys: shortcutCaps("thwart", "left"), padIntent: null, label: "Thwart" },
  { id: "recover", keys: shortcutCaps("recover", "left"), padIntent: null, label: "Recover" },
  { id: "changeForm", keys: shortcutCaps("changeForm", "left"), padIntent: null, label: "Change form" },
  { id: "ability1", keys: shortcutCaps("ability1", "left"), padIntent: null, label: "First ability" },
  { id: "ability2", keys: shortcutCaps("ability2", "left"), padIntent: null, label: "Second ability" },
  { id: "ability3", keys: shortcutCaps("ability3", "left"), padIntent: null, label: "Third ability" },
  { id: "ability4", keys: shortcutCaps("ability4", "left"), padIntent: null, label: "Fourth ability" },
  { id: "endTurn", keys: shortcutCaps("endTurn", "left"), padIntent: "endTurn", label: "End turn" },
  { id: "undo", keys: shortcutCaps("undo", "left"), padIntent: "undo", label: "Undo" },
  { id: "pause", keys: shortcutCaps("pause", "left"), padIntent: "pause", label: "Pause" },
  { id: "recap", keys: shortcutCaps("recap", "left"), padIntent: "view", label: "Villain phase recap" },
  { id: "log", keys: shortcutCaps("log", "left"), padIntent: "view", label: "Game log" },
  { id: "zoneUp", keys: shortcutCaps("zoneUp", "left"), padIntent: "pagePrevious", label: "Previous zone" },
  { id: "zoneDown", keys: shortcutCaps("zoneDown", "left"), padIntent: "pageNext", label: "Next zone" },
  { id: "zonePrevious", keys: shortcutCaps("zonePrevious", "left"), padIntent: "pagePrevious", label: "Previous zone" },
  { id: "zoneNext", keys: shortcutCaps("zoneNext", "left"), padIntent: "pageNext", label: "Next zone" },
  { id: "peek", keys: shortcutCaps("peek", "left"), padIntent: "view", label: "Peek at table (decision popup)" },
  {
    id: "expand",
    keys: shortcutCaps("expand", "left"),
    padIntent: "expand",
    label: "Expand / collapse a decision popup",
  },
  { id: "teamUp", keys: shortcutCaps("teamUp", "left"), padIntent: null, label: "Team-Up" },
  { id: "evidence", keys: shortcutCaps("evidence", "left"), padIntent: null, label: "Evidence" },
];

const BY_ID: ReadonlyMap<ShortcutId, Shortcut> = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export function shortcutOf(id: ShortcutId): Shortcut {
  return BY_ID.get(id)!;
}
