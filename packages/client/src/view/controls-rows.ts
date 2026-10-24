/**
 * What the Controls screen (`scenes/controls.ts`) says: the status line, the drawing's caption, the three settings
 * rows and the button and key lists. Pure data over `view/pad-family.ts`, `view/gamepad.ts` and
 * `view/input-shortcuts.ts`, so the wording and the glyphs can't drift from the tables the handlers read.
 */

import type { Settings } from "../settings.js";
import { padGlyphSpec, type GlyphSpec } from "./input-glyph-model.js";
import { shortcutOf, type ShortcutId } from "./input-shortcuts.js";
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
  { id: "undo", index: 6, action: "Undo", note: "On the table" },
  { id: "endTurn", index: 7, action: "End turn", note: "On the table; asks first if actions remain" },
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

function shortcutRow(id: ShortcutId, note: string, action?: string): ControlsListRow {
  const shortcut = shortcutOf(id);
  return { id, glyphs: shortcut.keys.map(key), action: action ?? shortcut.label, note };
}

export function keyboardGroupsOf(): readonly KeyboardGroup[] {
  return [
    {
      id: "everywhere",
      title: "EVERYWHERE",
      rows: [
        {
          id: "move",
          glyphs: ["←", "↑", "↓", "→"].map(key),
          action: "Move focus",
          note: "To the nearest control that way",
        },
        { id: "tab", glyphs: [key("Tab")], action: "Next control", note: "Shift+Tab goes back" },
        shortcutRow("activate", "Space works too", "Select · press"),
        shortcutRow("cancel", "With nothing open on the table, Pause", "Back · cancel"),
        shortcutRow("inspect", "Where a card has focus"),
        shortcutRow("guide", "On the table, when the guide is showing"),
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
        shortcutRow("attack", "Your hero's basic attack"),
        shortcutRow("thwart", "Your hero's basic thwart"),
        shortcutRow("recover", "The alter-ego's basic recover"),
        shortcutRow("changeForm", "Hero / alter-ego"),
        shortcutRow("endTurn", "Asks first if actions remain"),
        shortcutRow("undo", "Takes back the last step"),
        {
          id: "zones",
          glyphs: [key("["), key("]")],
          action: "Previous · next zone",
          note: "Jump between hand, play area, villain and actions",
        },
        shortcutRow("log", "Opens the game log"),
        shortcutRow("teamUp", "When a Team-Up is available"),
        shortcutRow("evidence", "When evidence is on the table"),
      ],
    },
    {
      id: "popup",
      title: "DECISION POPUP",
      rows: [
        shortcutRow("peek", "Shows the table behind the popup"),
        shortcutRow("expand", "Opens or closes the full popup"),
        {
          id: "choose",
          glyphs: [key("1"), key("2"), key("3")],
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
