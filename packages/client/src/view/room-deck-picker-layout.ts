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
