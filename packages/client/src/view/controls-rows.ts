/**
 * What the Controls screen (`scenes/controls.ts`) says: the status line, the drawing's caption, the three settings
 * rows and the button and key lists. Pure data over `view/pad-family.ts`, `view/gamepad.ts` and
 * `view/input-shortcuts.ts`, so the wording and the glyphs can't drift from the tables the handlers read.
 */

import type { Settings } from "../settings.js";
import { padGlyphSpec, type GlyphSpec } from "./input-glyph-model.js";
import { shortcutCaps, shortcutOf, type KeyboardHand, type ShortcutId } from "./input-shortcuts.js";
import { layerSheet, type LayerRow, type PadLayer } from "./pad-layers.js";
import {
  padFamilyName,
  PAD_FAMILY_SETTING_VALUES,
  resolvePadFamily,
  usesNintendoSwap,
  type PadFamily,
  type PadFamilySetting,
  type PadIdentity,
} from "./pad-family.js";

export type ControlsTab = "controller" | "keyboard";

/** Which body the drawing shows: a handheld wins over the family, whose labels it still wears. */
export type DrawingKind = "xbox" | "playstation" | "nintendo" | "handheld";

export function drawingKindOf(family: PadFamily, pad: PadIdentity | null): DrawingKind {
  return pad?.handheld ? "handheld" : family;
}

/** A pad's name for the status line, from `Gamepad.id`: the browser's "(STANDARD GAMEPAD Vendor: …)" tail dropped. */
export function padDisplayName(id: string): string {
  const name = id
    .replace(/\(.*?\)/g, "")
    .replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, "")
    .trim();
  return name.length > 0 ? name : id.trim();
}

export interface PadStatus {
  readonly connected: boolean;
  readonly text: string;
}

/**
 * The status line at the tab rail's right. `rawId` is the connected `Gamepad.id`, or null when none is. It names the
 * DETECTED pad's family, never the label override in settings.
 */
export function padStatusOf(rawId: string | null, pad: PadIdentity | null): PadStatus {
  if (rawId === null) return { connected: false, text: "No controller connected" };
  if (pad?.steam) {
    return {
      connected: true,
      text: pad.handheld ? "Steam Deck controls · through Steam Input" : "Steam Input controller · through Steam",
    };
  }
  return {
    connected: true,
    text: `${padFamilyName(pad?.family ?? "xbox")} controller connected · ${padDisplayName(rawId)}`,
  };
}

/** The one line under the drawing that says how this layout acts. */
export function controllerCaptionOf(family: PadFamily, pad: PadIdentity | null, swap: boolean): string {
  if (pad?.steam) {
    return "Steam Input sends its own layout, so buttons act as Steam sends them: A confirms, B backs out.";
  }
  if (family === "nintendo") {
    return swap
      ? "Switch layout: A (right) confirms and B (bottom) backs out, as on a Switch."
      : "Buttons act by position: the bottom button confirms and the right one backs out.";
  }
  if (family === "playstation") return "✕ confirms and ○ backs out. L1 / R1 page lists and jump between zones.";
  return "A confirms and B backs out. LB / RB page lists and jump between zones.";
}

export interface SegmentedRowInfo<V extends string> {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly selected: V;
}

const PAD_FAMILY_LABELS: Readonly<Record<PadFamilySetting, string>> = {
  auto: "Auto",
  xbox: "Xbox",
  playstation: "PlayStation",
  nintendo: "Switch",
};

export function padFamilyRowInfoOf(settings: Settings): SegmentedRowInfo<PadFamilySetting> {
  return {
    title: "Button labels",
    detail: "Auto follows the connected controller. Pick one when the wrong labels show.",
    options: PAD_FAMILY_SETTING_VALUES.map((value) => ({ value, label: PAD_FAMILY_LABELS[value] })),
    selected: settings.padGlyphFamily,
  };
}

export function nextSettingsAfterPadFamily(settings: Settings, value: PadFamilySetting): Settings {
  return { ...settings, padGlyphFamily: value };
}

export const STEAM_NINTENDO_DETAIL = "Off under Steam: Steam Input has its own Nintendo layout option";

export interface ControlsToggleInfo {
  readonly id: "nintendo" | "hints";
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
  /** Present when the toggle can't be changed: the chip label drawn in place of ON / OFF. */
  readonly locked?: { readonly chip: string };
}

export function nintendoToggleInfoOf(settings: Settings, pad: PadIdentity | null): ControlsToggleInfo {
  const steam = pad?.steam === true;
  return {
    id: "nintendo",
    title: "Use Nintendo Switch layout",
    detail: steam
      ? STEAM_NINTENDO_DETAIL
      : "On a Nintendo-style controller, buttons act by their printed label: A (right) confirms, B (bottom) backs out.",
    on: steam ? false : settings.nintendoLayout,
    ...(steam ? { locked: { chip: "STEAM" } } : {}),
  };
}

export function nextSettingsAfterNintendo(settings: Settings): Settings {
  return { ...settings, nintendoLayout: !settings.nintendoLayout };
}

export function hintsToggleInfoOf(settings: Settings): ControlsToggleInfo {
  return {
    id: "hints",
    title: "Show button and key hints",
    detail: "Draws the key or button for a control beside it while a keyboard or controller is in use. Never on touch.",
    on: settings.inputGlyphs,
  };
}

export function nextSettingsAfterHints(settings: Settings): Settings {
  return { ...settings, inputGlyphs: !settings.inputGlyphs };
}

export function keyboardHandRowInfoOf(settings: Settings): SegmentedRowInfo<KeyboardHand> {
  return {
    title: "Keyboard hand",
    detail: "Right moves every shortcut to the right hand, for a mouse in your left hand.",
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
    selected: settings.keyboardHand,
  };
}

export function nextSettingsAfterKeyboardHand(settings: Settings, value: KeyboardHand): Settings {
  return { ...settings, keyboardHand: value };
}

export interface ControlsListRow {
  readonly id: string;
  readonly glyphs: readonly GlyphSpec[];
  readonly action: string;
  /** Where it applies. */
  readonly note: string;
}

const fixedGlyph = (label: string, shape: "dpad" | "stick", name: string): GlyphSpec => ({
  kind: "pad",
  label,
  shape,
  symbol: null,
  name,
});

interface PadRowDef {
  readonly id: string;
  /** Standard-layout index, or a fixed glyph for the D-pad and the right stick. */
  readonly index?: number;
  readonly fixed?: GlyphSpec;
  readonly action: string;
  readonly note: string;
}

const PAD_ROWS: readonly PadRowDef[] = [
  {
    id: "move",
    fixed: fixedGlyph("D-pad", "dpad", "D-pad"),
    action: "Move focus",
    note: "Everywhere; the left stick does the same",
  },
  {
    id: "activate",
    index: 0,
    action: "Select · play the focused card",
    note: "Everywhere; on the table it plays or uses the card",
  },
  { id: "cancel", index: 1, action: "Back · cancel", note: "Everywhere; with nothing open on the table, Pause" },
  { id: "guide", index: 2, action: "Move focus to the guide", note: "On the table, when the guide is showing" },
  { id: "inspect", index: 3, action: "Inspect · hold to zoom", note: "Where a card has focus" },
  { id: "pagePrevious", index: 4, action: "Previous zone · page", note: "Table: previous zone. Lists: previous page" },
  { id: "pageNext", index: 5, action: "Next zone · page", note: "Table: next zone. Lists: next page" },
  { id: "view", index: 8, action: "Game log · Peek at table", note: "On the table; Peek on a decision popup" },
  { id: "pause", index: 9, action: "Pause", note: "Anywhere in a game" },
  {
    id: "scroll",
    fixed: fixedGlyph("RS", "stick", "Right stick"),
    action: "Scroll",
    note: "The list, hand or log under focus",
  },
  { id: "expand", index: 11, action: "Expand · collapse", note: "On a decision popup" },
];

/** What each layer row says it does and where. */
const LAYER_NOTES: Readonly<Record<string, string>> = {
  attack: "Your hero's basic attack",
  thwart: "Your hero's basic thwart",
  recover: "The alter-ego's basic recover",
  changeForm: "Hero / alter-ego",
  undo: "Takes back the last step",
  endTurn: "Asks first if actions remain",
  ability1: "The first ability usable now on your cards in play",
  ability2: "The second usable ability",
  ability3: "The third usable ability",
  ability4: "The fourth usable ability",
  pagePrevious: "When there are more than four abilities",
  pageNext: "When there are more than four abilities",
};

export interface PadLayerSection {
  readonly id: "holdLt" | "holdRt";
  readonly title: string;
  readonly rows: readonly ControlsListRow[];
}

function layerRowOf(row: LayerRow, trigger: GlyphSpec | null): ControlsListRow {
  return {
    id: row.action,
    glyphs: [...(trigger ? [trigger] : []), ...(row.glyph ? [row.glyph] : [])],
    action: row.label,
    note: LAYER_NOTES[row.action] ?? "",
  };
}

/** The "HOLD LT" and "HOLD RT" sections of the BUTTONS list: the trigger plus the button, for this pad. */
export function padLayerSectionsOf(family: PadFamily, swap: boolean): readonly PadLayerSection[] {
  const section = (layer: PadLayer, id: PadLayerSection["id"], title: string): PadLayerSection => {
    const sheet = layerSheet(layer, family, swap);
    return { id, title, rows: sheet.rows.map((row) => layerRowOf(row, sheet.trigger)) };
  };
  return [section("lt", "holdLt", "HOLD LT"), section("rt", "holdRt", "HOLD RT")];
}

/** The BUTTONS list for a family, with the Nintendo swap already applied to each glyph. */
export function padRowsOf(family: PadFamily, swap: boolean): readonly ControlsListRow[] {
  return PAD_ROWS.map((def) => {
    const spec = def.fixed ?? (def.index === undefined ? null : padGlyphSpec(def.index, family, swap));
    return { id: def.id, glyphs: spec ? [spec] : [], action: def.action, note: def.note };
  });
}

export interface KeyboardGroup {
  readonly id: "everywhere" | "table" | "popup";
  readonly title: string;
  readonly rows: readonly ControlsListRow[];
}

const key = (label: string): GlyphSpec => ({ kind: "key", label, name: `${label} key` });

function capsOf(ids: readonly ShortcutId[], hand: KeyboardHand): readonly GlyphSpec[] {
  return ids.flatMap((id) => shortcutCaps(id, hand).map(key));
}

function shortcutRow(id: ShortcutId, hand: KeyboardHand, note: string, action?: string): ControlsListRow {
  return { id, glyphs: shortcutCaps(id, hand).map(key), action: action ?? shortcutOf(id).label, note };
}

/** The Keyboard tab's groups for the active hand. Arrows, Enter and Esc work under both hands. */
export function keyboardGroupsOf(hand: KeyboardHand = "left"): readonly KeyboardGroup[] {
  const left = hand === "left";
  return [
    {
      id: "everywhere",
      title: "EVERYWHERE",
      rows: [
        {
          id: "move",
          glyphs: capsOf(["moveUp", "moveLeft", "moveDown", "moveRight"], hand),
          action: "Move focus",
          note: "To the nearest control that way; the arrow keys work too",
        },
        shortcutRow("select", hand, left ? "Enter works too" : "Everywhere", "Select · press"),
        shortcutRow("back", hand, "Esc works too; with nothing open on the table, Pause", "Back · cancel"),
        shortcutRow("inspect", hand, "Where a card has focus"),
        shortcutRow("guide", hand, "On the table, when the guide is showing"),
        { id: "tab", glyphs: [key("Tab")], action: "Next control", note: "Shift+Tab goes back" },
        {
          id: "page",
          glyphs: [key("PgUp"), key("PgDn")],
          action: "Page a list",
          note: "Home and End jump to the ends",
        },
      ],
    },
    {
      id: "table",
      title: "ON THE TABLE",
      rows: [
        shortcutRow("attack", hand, "Your hero's basic attack"),
        shortcutRow("thwart", hand, "Your hero's basic thwart"),
        shortcutRow("recover", hand, "The alter-ego's basic recover"),
        shortcutRow("changeForm", hand, "Hero / alter-ego"),
        {
          id: "abilities",
          glyphs: capsOf(["ability1", "ability2", "ability3", "ability4"], hand),
          action: "Card abilities",
          note: "The first four usable abilities on your cards in play, in table order",
        },
        shortcutRow("endTurn", hand, "Asks first if actions remain"),
        shortcutRow("undo", hand, "Takes back the last step"),
        {
          id: "zones",
          glyphs: capsOf(["zoneUp", "zoneDown"], hand),
          action: "Zone up · down",
          note: "Jump between hand, play area, villain and actions",
        },
        shortcutRow("log", hand, "Opens the game log"),
        shortcutRow("teamUp", hand, "When a Team-Up is available"),
        shortcutRow("evidence", hand, "When evidence is on the table"),
      ],
    },
    {
      id: "popup",
      title: "DECISION POPUP",
      rows: [
        shortcutRow("peek", hand, "Shows the table behind the popup"),
        shortcutRow("expand", hand, "Opens or closes the full popup"),
        {
          id: "choose",
          glyphs: capsOf(["ability1", "ability2", "ability3"], hand),
          action: "Answer a small choice",
          note: "The numbered option",
        },
      ],
    },
  ];
}

/** The family, swap and drawing the Controls screen shows for these settings and the last pad seen. */
export function controllerStateOf(
  settings: Pick<Settings, "padGlyphFamily" | "nintendoLayout">,
  pad: PadIdentity | null,
): { readonly family: PadFamily; readonly swap: boolean; readonly kind: DrawingKind } {
  const family = resolvePadFamily(settings.padGlyphFamily, pad);
  return { family, swap: usesNintendoSwap(family, settings.nintendoLayout, pad), kind: drawingKindOf(family, pad) };
}
