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
import { t } from "../i18n/translate.js";
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
  /** The forward button of whatever decision is open on the Board (Pay, Play it, Confirm): Start on a pad. */
  | "confirm"
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
  | "evidence"
  /** Opens your discard pile from anywhere on the table (L3 on a pad). */
  | "discard"
  /** Lists the cards left in your decks from the table (R3 on a pad, which Expand only uses on a popup). */
  | "deckLeft";

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
    // Not Enter: Enter is Select on the focused card, which in a payment spends it.
    confirm: [chord(left ? "KeyP" : "KeyG")],
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
    // Every left-hand letter is taken, so the digit row's spare 5 (6 under the right hand: 7-0 are its abilities).
    discard: [chord(left ? "Digit5" : "Digit6")],
    deckLeft: [chord(left ? "Digit6" : "Digit5")],
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
    get label() {
      return t("controls.shortcut.select.play");
    },
  },
  {
    id: "select",
    keys: shortcutCaps("select", "left"),
    padIntent: "activate",
    get label() {
      return t("controls.shortcut.select");
    },
  },
  {
    id: "cancel",
    keys: shortcutCaps("cancel", "left"),
    padIntent: "cancel",
    get label() {
      return t("controls.shortcut.backCancel");
    },
  },
  {
    id: "back",
    keys: shortcutCaps("back", "left"),
    padIntent: "cancel",
    get label() {
      return t("controls.shortcut.back");
    },
  },
  {
    id: "inspect",
    keys: shortcutCaps("inspect", "left"),
    padIntent: "inspect",
    get label() {
      return t("controls.shortcut.inspect");
    },
  },
  {
    id: "guide",
    keys: shortcutCaps("guide", "left"),
    padIntent: "toggleGuide",
    get label() {
      return t("controls.shortcut.guide");
    },
  },
  {
    id: "moveUp",
    keys: shortcutCaps("moveUp", "left"),
    padIntent: "up",
    get label() {
      return t("controls.shortcut.moveUp");
    },
  },
  {
    id: "moveDown",
    keys: shortcutCaps("moveDown", "left"),
    padIntent: "down",
    get label() {
      return t("controls.shortcut.moveDown");
    },
  },
  {
    id: "moveLeft",
    keys: shortcutCaps("moveLeft", "left"),
    padIntent: "left",
    get label() {
      return t("controls.shortcut.moveLeft");
    },
  },
  {
    id: "moveRight",
    keys: shortcutCaps("moveRight", "left"),
    padIntent: "right",
    get label() {
      return t("controls.shortcut.moveRight");
    },
  },
  {
    id: "attack",
    keys: shortcutCaps("attack", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.attack");
    },
  },
  {
    id: "thwart",
    keys: shortcutCaps("thwart", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.thwart");
    },
  },
  {
    id: "recover",
    keys: shortcutCaps("recover", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.recover");
    },
  },
  {
    id: "changeForm",
    keys: shortcutCaps("changeForm", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.changeForm");
    },
  },
  {
    id: "ability1",
    keys: shortcutCaps("ability1", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.ability1");
    },
  },
  {
    id: "ability2",
    keys: shortcutCaps("ability2", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.ability2");
    },
  },
  {
    id: "ability3",
    keys: shortcutCaps("ability3", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.ability3");
    },
  },
  {
    id: "ability4",
    keys: shortcutCaps("ability4", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.ability4");
    },
  },
  {
    id: "endTurn",
    keys: shortcutCaps("endTurn", "left"),
    padIntent: "endTurn",
    get label() {
      return t("controls.shortcut.endTurn");
    },
  },
  {
    id: "undo",
    keys: shortcutCaps("undo", "left"),
    padIntent: "undo",
    get label() {
      return t("controls.shortcut.undo");
    },
  },
  {
    id: "pause",
    keys: shortcutCaps("pause", "left"),
    padIntent: "pause",
    get label() {
      return t("controls.shortcut.pause");
    },
  },
  {
    id: "confirm",
    keys: shortcutCaps("confirm", "left"),
    padIntent: "pause",
    get label() {
      return t("controls.shortcut.confirm");
    },
  },
  {
    id: "recap",
    keys: shortcutCaps("recap", "left"),
    padIntent: "view",
    get label() {
      return t("controls.shortcut.recap");
    },
  },
  {
    id: "log",
    keys: shortcutCaps("log", "left"),
    padIntent: "view",
    get label() {
      return t("controls.shortcut.log");
    },
  },
  {
    id: "zoneUp",
    keys: shortcutCaps("zoneUp", "left"),
    padIntent: "pagePrevious",
    get label() {
      return t("controls.shortcut.zonePrevious");
    },
  },
  {
    id: "zoneDown",
    keys: shortcutCaps("zoneDown", "left"),
    padIntent: "pageNext",
    get label() {
      return t("controls.shortcut.zoneNext");
    },
  },
  {
    id: "zonePrevious",
    keys: shortcutCaps("zonePrevious", "left"),
    padIntent: "pagePrevious",
    get label() {
      return t("controls.shortcut.zonePrevious");
    },
  },
  {
    id: "zoneNext",
    keys: shortcutCaps("zoneNext", "left"),
    padIntent: "pageNext",
    get label() {
      return t("controls.shortcut.zoneNext");
    },
  },
  {
    id: "peek",
    keys: shortcutCaps("peek", "left"),
    padIntent: "view",
    get label() {
      return t("controls.shortcut.peek");
    },
  },
  {
    id: "expand",
    keys: shortcutCaps("expand", "left"),
    padIntent: "expand",
    get label() {
      return t("controls.shortcut.expand");
    },
  },
  {
    id: "teamUp",
    keys: shortcutCaps("teamUp", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.teamUp");
    },
  },
  {
    id: "evidence",
    keys: shortcutCaps("evidence", "left"),
    padIntent: null,
    get label() {
      return t("controls.shortcut.evidence");
    },
  },
  {
    id: "discard",
    keys: shortcutCaps("discard", "left"),
    padIntent: "discard",
    get label() {
      return t("controls.shortcut.discard");
    },
  },
  {
    id: "deckLeft",
    keys: shortcutCaps("deckLeft", "left"),
    padIntent: "expand",
    get label() {
      return t("controls.shortcut.deckLeft");
    },
  },
];

const BY_ID: ReadonlyMap<ShortcutId, Shortcut> = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export function shortcutOf(id: ShortcutId): Shortcut {
  return BY_ID.get(id)!;
}
