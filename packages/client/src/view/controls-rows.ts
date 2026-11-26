/**
 * What the Controls screen (`scenes/controls.ts`) says: the status line, the drawing's caption, the three settings
 * rows and the button and key lists. Pure data over `view/pad-family.ts`, `view/gamepad.ts` and
 * `view/input-shortcuts.ts`, so the wording and the glyphs can't drift from the tables the handlers read.
 */

import { t } from "../i18n/translate.js";
import { GLYPH_SIZE_MAX, GLYPH_SIZE_MIN, GLYPH_SIZE_STEP, clampGlyphSize, type Settings } from "../settings.js";
import { padGlyphSpec, type GlyphSpec, type PadGlyphSpec } from "./input-glyph-model.js";
import type { GlyphSource } from "./input-mode.js";
import { shortcutCaps, shortcutOf, type KeyboardHand, type ShortcutId } from "./input-shortcuts.js";
import { layerSheet, type LayerRow, type PadLayer } from "./pad-layers.js";
import { glyphArtFor, type GlyphArt } from "./pad-glyph-art.js";
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
  if (rawId === null) return { connected: false, text: t("controls.status.none") };
  if (pad?.steam) {
    return {
      connected: true,
      text: pad.handheld ? t("controls.status.deck") : t("controls.status.steam"),
    };
  }
  return {
    connected: true,
    text: t("controls.status.connected", { family: padFamilyName(pad?.family ?? "xbox"), pad: padDisplayName(rawId) }),
  };
}

/** The one line under the drawing that says how this layout acts. */
export function controllerCaptionOf(family: PadFamily, pad: PadIdentity | null, swap: boolean): string {
  if (pad?.steam) {
    return t("controls.caption.steam");
  }
  if (family === "nintendo") {
    return swap ? t("controls.caption.switchSwap") : t("controls.caption.switchPos");
  }
  if (family === "playstation") return t("controls.caption.ps");
  return t("controls.caption.xbox");
}

export interface SegmentedRowInfo<V extends string> {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly selected: V;
  /** Drawn faded (but still adjustable), as the hint size row is while hints are off. */
  readonly dimmed?: boolean;
}

const padFamilyLabels = (): Readonly<Record<PadFamilySetting, string>> => ({
  auto: t("controls.auto"),
  xbox: "Xbox",
  playstation: "PlayStation",
  nintendo: "Switch",
});

export function padFamilyRowInfoOf(settings: Settings): SegmentedRowInfo<PadFamilySetting> {
  return {
    title: t("controls.labels.title"),
    detail: t("controls.labels.detail"),
    options: PAD_FAMILY_SETTING_VALUES.map((value) => ({ value, label: padFamilyLabels()[value] })),
    selected: settings.padGlyphFamily,
  };
}

export function nextSettingsAfterPadFamily(settings: Settings, value: PadFamilySetting): Settings {
  return { ...settings, padGlyphFamily: value };
}

export function glyphSourceRowInfoOf(settings: Settings): SegmentedRowInfo<GlyphSource> {
  return {
    title: t("controls.source.title"),
    detail: t("controls.source.detail"),
    options: [
      { value: "auto", label: t("controls.auto") },
      { value: "pad", label: t("controls.source.pad") },
      { value: "keyboard", label: t("controls.source.keyboard") },
    ],
    selected: settings.glyphSource,
    dimmed: !settings.inputGlyphs,
  };
}

export function nextSettingsAfterGlyphSource(settings: Settings, value: GlyphSource): Settings {
  return { ...settings, glyphSource: value };
}

export const steamNintendoDetail = (): string => t("controls.nintendo.steam");

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
    title: t("controls.nintendo.title"),
    detail: steam ? steamNintendoDetail() : t("controls.nintendo.detail"),
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
    title: t("controls.hints.title"),
    detail: t("controls.hints.detail"),
    on: settings.inputGlyphs,
  };
}

export function nextSettingsAfterHints(settings: Settings): Settings {
  return { ...settings, inputGlyphs: !settings.inputGlyphs };
}

export interface HintSizeRowInfo {
  readonly id: "hintSize";
  readonly title: string;
  readonly detail: string;
  /** The hint size now, in percent of the base size. */
  readonly percent: number;
  /** Dimmed (but still adjustable) while the hints are off. */
  readonly dimmed: boolean;
}

export function hintSizeRowInfoOf(settings: Settings): HintSizeRowInfo {
  return {
    id: "hintSize",
    title: t("controls.hintSize.title"),
    detail: t("controls.hintSize.detail"),
    percent: clampGlyphSize(settings.glyphSize),
    dimmed: !settings.inputGlyphs,
  };
}

export function nextSettingsAfterHintSize(settings: Settings, percent: number): Settings {
  return { ...settings, glyphSize: clampGlyphSize(percent) };
}

/** The hint size a press or drag at `x` along the slider's track sets: the share of the track left of it, to a step. */
export function glyphSizeAtTrack(x: number, track: { readonly x: number; readonly width: number }): number {
  if (track.width <= 0) return GLYPH_SIZE_MAX;
  const share = Math.min(1, Math.max(0, (x - track.x) / track.width));
  return clampGlyphSize(GLYPH_SIZE_MIN + share * (GLYPH_SIZE_MAX - GLYPH_SIZE_MIN));
}

/** The knob's share along the track (0 to 1) for a hint size. */
export const glyphSizeShare = (percent: number): number =>
  (clampGlyphSize(percent) - GLYPH_SIZE_MIN) / (GLYPH_SIZE_MAX - GLYPH_SIZE_MIN);

/** One step of the hint size down (`-1`) or up (`1`): 5 points, kept in range. */
export const steppedGlyphSize = (percent: number, direction: -1 | 1): number =>
  clampGlyphSize(clampGlyphSize(percent) + direction * GLYPH_SIZE_STEP);

export function keyboardHandRowInfoOf(settings: Settings): SegmentedRowInfo<KeyboardHand> {
  return {
    title: t("controls.hand.title"),
    detail: t("controls.hand.detail"),
    options: [
      { value: "left", label: t("controls.hand.left") },
      { value: "right", label: t("controls.hand.right") },
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

interface FixedGlyph {
  readonly spec: PadGlyphSpec;
  readonly art: GlyphArt;
}

const fixedGlyph = (label: string, shape: "dpad" | "stick", name: string, art: GlyphArt): FixedGlyph => ({
  spec: { kind: "pad", label, shape, symbol: null, name },
  art,
});

/** A fixed glyph as this family draws it: with the family's picture where its set has one. */
function fixedFor(fixed: FixedGlyph, family: PadFamily): PadGlyphSpec {
  const art = glyphArtFor(family, fixed.art);
  return { ...fixed.spec, ...(art === null ? {} : { art }) };
}

interface PadRowDef {
  readonly id: string;
  /** Standard-layout index, or a fixed glyph for the D-pad and the right stick. */
  readonly index?: number;
  /** Drawn the same on every family, apart from the family's picture. */
  readonly fixed?: FixedGlyph;
  readonly action: string;
  readonly note: string;
}

const padRowDefs = (): readonly PadRowDef[] => [
  {
    id: "move",
    fixed: fixedGlyph("D-pad", "dpad", "D-pad", "dpad"),
    action: t("controls.pad.move.action"),
    note: t("controls.pad.move.note"),
  },
  {
    id: "activate",
    index: 0,
    action: t("controls.pad.activate.action"),
    note: t("controls.pad.activate.note"),
  },
  { id: "cancel", index: 1, action: t("controls.pad.cancel.action"), note: t("controls.pad.cancel.note") },
  {
    id: "guide",
    index: 2,
    action: t("controls.pad.guide.action"),
    note: t("controls.pad.guide.note"),
  },
  { id: "inspect", index: 3, action: t("controls.pad.inspect.action"), note: t("controls.pad.inspect.note") },
  {
    id: "pagePrevious",
    index: 4,
    action: t("controls.pad.pagePrevious.action"),
    note: t("controls.pad.pagePrevious.note"),
  },
  {
    id: "pageNext",
    index: 5,
    action: t("controls.pad.pageNext.action"),
    note: t("controls.pad.pageNext.note"),
  },
  {
    id: "view",
    index: 8,
    action: t("controls.pad.view.action"),
    note: t("controls.pad.view.note"),
  },
  {
    id: "pause",
    index: 9,
    action: t("controls.pad.pause.action"),
    note: t("controls.pad.pause.note"),
  },
  {
    id: "scroll",
    fixed: fixedGlyph("RS", "stick", "Right stick", "rstick"),
    action: t("controls.pad.scroll.action"),
    note: t("controls.pad.scroll.note"),
  },
  {
    id: "expand",
    index: 11,
    action: t("controls.pad.expand.action"),
    note: t("controls.pad.expand.note"),
  },
  {
    id: "discard",
    index: 10,
    action: t("controls.pad.discard.action"),
    note: t("controls.pad.discard.note"),
  },
];

/** What each layer row says it does and where. */
const layerNotes = (): Readonly<Record<string, string>> => ({
  attack: t("controls.layerNote.attack"),
  thwart: t("controls.layerNote.thwart"),
  recover: t("controls.layerNote.recover"),
  changeForm: t("controls.layerNote.changeForm"),
  undo: t("controls.layerNote.undo"),
  endTurn: t("controls.layerNote.endTurn"),
  ability1: t("controls.layerNote.ability1"),
  ability2: t("controls.layerNote.ability2"),
  ability3: t("controls.layerNote.ability3"),
  ability4: t("controls.layerNote.ability4"),
  pagePrevious: t("controls.layerNote.page"),
  pageNext: t("controls.layerNote.page"),
});

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
    note: layerNotes()[row.action] ?? "",
  };
}

/** The "HOLD LT" and "HOLD RT" sections of the BUTTONS list: the trigger plus the button, for this pad. */
export function padLayerSectionsOf(family: PadFamily, swap: boolean): readonly PadLayerSection[] {
  const section = (layer: PadLayer, id: PadLayerSection["id"], title: string): PadLayerSection => {
    const sheet = layerSheet(layer, family, swap);
    return { id, title, rows: sheet.rows.map((row) => layerRowOf(row, sheet.trigger)) };
  };
  return [section("lt", "holdLt", t("controls.holdLt")), section("rt", "holdRt", t("controls.holdRt"))];
}

/** The BUTTONS list for a family, with the Nintendo swap already applied to each glyph. */
export function padRowsOf(family: PadFamily, swap: boolean): readonly ControlsListRow[] {
  return padRowDefs().map((def) => {
    const spec = def.fixed
      ? fixedFor(def.fixed, family)
      : def.index === undefined
        ? null
        : padGlyphSpec(def.index, family, swap);
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
      title: t("controls.group.everywhere"),
      rows: [
        {
          id: "move",
          glyphs: capsOf(["moveUp", "moveLeft", "moveDown", "moveRight"], hand),
          action: t("controls.kb.move.action"),
          note: t("controls.kb.move.note"),
        },
        shortcutRow(
          "select",
          hand,
          left ? t("controls.kb.select.leftNote") : t("controls.kb.select.rightNote"),
          t("controls.kb.select.action"),
        ),
        shortcutRow("back", hand, t("controls.kb.back.note"), t("controls.kb.back.action")),
        shortcutRow("inspect", hand, t("controls.kb.inspect.note")),
        shortcutRow("guide", hand, t("controls.kb.guide.note")),
        { id: "tab", glyphs: [key("Tab")], action: t("controls.kb.tab.action"), note: t("controls.kb.tab.note") },
        {
          id: "page",
          glyphs: [key("PgUp"), key("PgDn")],
          action: t("controls.kb.page.action"),
          note: t("controls.kb.page.note"),
        },
      ],
    },
    {
      id: "table",
      title: t("controls.group.table"),
      rows: [
        shortcutRow("attack", hand, t("controls.kb.attack")),
        shortcutRow("thwart", hand, t("controls.kb.thwart")),
        shortcutRow("recover", hand, t("controls.kb.recover")),
        shortcutRow("changeForm", hand, t("controls.kb.changeForm")),
        {
          id: "abilities",
          glyphs: capsOf(["ability1", "ability2", "ability3", "ability4"], hand),
          action: t("controls.kb.abilities.action"),
          note: t("controls.kb.abilities.note"),
        },
        shortcutRow("endTurn", hand, t("controls.kb.endTurn")),
        shortcutRow("undo", hand, t("controls.kb.undo")),
        {
          id: "zones",
          glyphs: capsOf(["zoneUp", "zoneDown"], hand),
          action: t("controls.kb.zones.action"),
          note: t("controls.kb.zones.note"),
        },
        shortcutRow("recap", hand, t("controls.kb.recap")),
        shortcutRow("log", hand, t("controls.kb.log")),
        shortcutRow("confirm", hand, t("controls.kb.confirm")),
        shortcutRow("teamUp", hand, t("controls.kb.teamUp")),
        shortcutRow("evidence", hand, t("controls.kb.evidence")),
        shortcutRow("discard", hand, t("controls.kb.discard")),
        shortcutRow("deckLeft", hand, t("controls.kb.deckLeft")),
      ],
    },
    {
      id: "popup",
      title: t("controls.group.popup"),
      rows: [
        shortcutRow("peek", hand, t("controls.kb.peek")),
        shortcutRow("expand", hand, t("controls.kb.expand")),
        {
          id: "choose",
          glyphs: capsOf(["ability1", "ability2", "ability3"], hand),
          action: t("controls.kb.choose.action"),
          note: t("controls.kb.choose.note"),
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
