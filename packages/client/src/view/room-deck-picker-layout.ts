/**
 * The room deck picker's two views and its details panel (#880; Quin, 2026-11-21): a grid of hero tiles (the default) or
 * the list it has always been, and, on selecting a deck, a panel that slides out from the right on a desktop or a wide
 * tablet and is a full sheet on a phone or a portrait tablet. Pure geometry and the remembered view; the scene draws what
 * this returns.
 */
import type { FormFactor, Rect } from "./layout.js";

export type PickerViewMode = "grid" | "list";

export const PICKER_VIEW_MODES: readonly PickerViewMode[] = ["grid", "list"];
export const DEFAULT_PICKER_VIEW: PickerViewMode = "grid";
/** The view left open last, kept beside the deck list's own (`view/deck-list-open.ts`): it changes by a tap, not by a setting. */
export const PICKER_VIEW_KEY = "mc-room-deck-view";

type ViewStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): ViewStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The stored view; anything unknown, or nothing, is the grid. */
export function readPickerView(storage: ViewStorage | null = browserStorage()): PickerViewMode {
  try {
    const raw = storage?.getItem(PICKER_VIEW_KEY) ?? null;
    return PICKER_VIEW_MODES.find((mode) => mode === raw) ?? DEFAULT_PICKER_VIEW;
  } catch {
    return DEFAULT_PICKER_VIEW;
  }
}

/** Remembers the view. Storage that refuses the write is no error: the choice holds for this visit. */
export function writePickerView(mode: PickerViewMode, storage: ViewStorage | null = browserStorage()): void {
  try {
    storage?.setItem(PICKER_VIEW_KEY, mode);
  } catch {
    // Private mode or a full quota.
  }
}

export interface PickerGridLayout {
  readonly columns: number;
  readonly gap: number;
  readonly tileWidth: number;
  /** The hero picture's height inside the tile. */
  readonly artHeight: number;
  /** The tile's text block under the picture: deck name, hero and aspects, status. */
  readonly textHeight: number;
  readonly tileHeight: number;
}

const GRID_GAP = 10;
const TILE_TEXT_HEIGHT = 66;
/** The narrowest a tile gets: a phone fits two to a row (375 wide: 2), a tablet or desktop packs more. */
const MIN_TILE = { phone: 140, wide: 176 } as const;
const MAX_COLUMNS = 6;

/** The tiles' geometry for a grid `width` wide (the scroll region's inner width): as many columns as keep every tile at least the minimum. */
export function pickerGridLayout(width: number, formFactor: FormFactor): PickerGridLayout {
  const narrow = formFactor === "phone" || formFactor === "phoneLandscape";
  const min = narrow ? MIN_TILE.phone : MIN_TILE.wide;
  const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + GRID_GAP) / (min + GRID_GAP))));
  const tileWidth = Math.floor((width - GRID_GAP * (columns - 1)) / columns);
  const artHeight = Math.round(tileWidth * 0.66);
  return {
    columns,
    gap: GRID_GAP,
    tileWidth,
    artHeight,
    textHeight: TILE_TEXT_HEIGHT,
    tileHeight: artHeight + TILE_TEXT_HEIGHT,
  };
}

/** The rect of tile `index` in a grid whose first tile is at (`left`, `top`). */
export function tileRect(layout: PickerGridLayout, left: number, top: number, index: number): Rect {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: left + column * (layout.tileWidth + layout.gap),
    y: top + row * (layout.tileHeight + layout.gap),
    width: layout.tileWidth,
    height: layout.tileHeight,
  };
}

/** The height the `count` tiles take, for the scroll region. */
export function gridContentHeight(layout: PickerGridLayout, count: number): number {
  if (count <= 0) return 0;
  const rows = Math.ceil(count / layout.columns);
  return rows * layout.tileHeight + (rows - 1) * layout.gap;
}

export type DetailsPresentation = "slide" | "sheet";

/** A desktop and a wide tablet in landscape have the room to keep the grid beside the panel; every other size gets a sheet. */
export const detailsPresentationOf = (formFactor: FormFactor): DetailsPresentation =>
  formFactor === "desktop" || formFactor === "tabletLandscape" ? "slide" : "sheet";

/** The slide-out panel's width: a desktop's is roomier than a landscape tablet's. */
export const slidePanelWidth = (formFactor: FormFactor): number => (formFactor === "desktop" ? 440 : 360);

/** Where the details panel sits inside `area` (the screen under the top bar): the right edge for a slide-out, all of it for a sheet. */
export function detailsPanelRect(area: Rect, presentation: DetailsPresentation, formFactor: FormFactor): Rect {
  if (presentation === "sheet") return area;
  const width = Math.min(slidePanelWidth(formFactor), area.width);
  return { x: area.x + area.width - width, y: area.y, width, height: area.height };
}

/**
 * How far the panel is from home at `progress` (0 just opened, 1 settled): a slide-out comes in from the right, a sheet
 * up from below. Reduced motion is settled at once. Ease-out, so it decelerates into place.
 */
export function panelOffsetAt(
  progress: number,
  presentation: DetailsPresentation,
  panel: Rect,
  reducedMotion: boolean,
): { readonly x: number; readonly y: number } {
  const p = reducedMotion ? 1 : Math.min(1, Math.max(0, progress));
  const away = (1 - p) * (1 - p) * (1 - p);
  return presentation === "slide"
    ? { x: Math.round(panel.width * away), y: 0 }
    : { x: 0, y: Math.round(panel.height * 0.35 * away) };
}

/**
 * A deck's name for a tile: the aspect it already wears as a stripe and in the line under it ("Spider-Man (Justice) —
 * Core Set starter deck" reads "Spider-Man — Core Set starter deck"), so a narrow tile spends its width on what tells decks apart.
 * Only a parenthetical that is wholly aspect names is dropped; a name that is nothing but one keeps it.
 */
export function tileTitleOf(name: string): string {
  const aspect = "(?:Aggression|Justice|Leadership|Protection|Basic|'Pool|Pool)";
  const stripped = name
    .replace(new RegExp(String.raw`\s*\(${aspect}(?:\s*(?:&|\+|/|,)\s*${aspect})*\)`), "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped === "" ? name : stripped;
}

export interface PickerControlsLayout {
  readonly search: Rect;
  readonly toggles: readonly [Rect, Rect];
  /** Build a deck. */
  readonly build: Rect;
  /** Import from MarvelCDB: opens (or closes) the link field. */
  readonly importToggle: Rect;
  /** The link field and its Import button, a row under the two, only while the import is open. */
  readonly importField: Rect | null;
  readonly importGo: Rect | null;
  /** Where the list may start: the bottom edge of the last control row. */
  readonly bottom: number;
}

const CONTROL_GAP = 6;
const IMPORT_GO_WIDTH = 104;

/**
 * The picker's control rows above the list, in the width `left` to `right` (the slide-out panel's edge on a wide
 * screen, the screen's gutter otherwise): search and the Grid / List toggle; under them Build a deck and Import from
 * MarvelCDB side by side, always there (a player with no deck needs them most); and, while Import is open, the link
 * field with its own Import button on a third row. Every rect is at least a touch target tall and nothing overlaps, at
 * any width a phone (343 of content) up to a desktop.
 */
export function pickerControlsLayout(args: {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly toggleWidth: number;
  readonly searchHeight: number;
  readonly buttonHeight: number;
  readonly importOpen: boolean;
}): PickerControlsLayout {
  const { left, right, top, toggleWidth, searchHeight, buttonHeight, importOpen } = args;
  const width = Math.max(0, right - left);
  const search: Rect = { x: left, y: top, width: width - (toggleWidth * 2 + CONTROL_GAP * 2), height: searchHeight };
  const toggleAt = (i: number): Rect => ({
    x: search.x + search.width + CONTROL_GAP + i * (toggleWidth + CONTROL_GAP),
    y: top,
    width: toggleWidth,
    height: searchHeight,
  });
  const rowTwo = top + searchHeight + CONTROL_GAP;
  const half = Math.floor((width - CONTROL_GAP) / 2);
  const build: Rect = { x: left, y: rowTwo, width: half, height: buttonHeight };
  const importToggle: Rect = {
    x: left + half + CONTROL_GAP,
    y: rowTwo,
    width: width - half - CONTROL_GAP,
    height: buttonHeight,
  };
  let bottom = rowTwo + buttonHeight;
  let importField: Rect | null = null;
  let importGo: Rect | null = null;
  if (importOpen) {
    const rowThree = bottom + CONTROL_GAP;
    const goWidth = Math.min(IMPORT_GO_WIDTH, Math.floor(width / 3));
    importField = { x: left, y: rowThree, width: width - goWidth - CONTROL_GAP, height: searchHeight };
    importGo = { x: left + width - goWidth, y: rowThree, width: goWidth, height: searchHeight };
    bottom = rowThree + searchHeight;
  }
  return { search, toggles: [toggleAt(0), toggleAt(1)], build, importToggle, importField, importGo, bottom };
}
