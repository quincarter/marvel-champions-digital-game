/**
 * The Extras screen (`scenes/extras.ts`), as plain data: its tabs with their open counts, each tab's tiles, and the
 * grid the tiles sit in. What is open, and why, is `progression/extras.ts`'s; this module only words and places it.
 */
import type { Picture } from "../art/pictures.js";
import {
  EXTRAS_ENTRIES,
  EXTRAS_TABS,
  unlockHint,
  type Extras,
  type ExtrasEntry,
  type ExtrasTab,
} from "../progression/extras.js";
import type { Rect } from "./layout.js";

export interface ExtrasTabView {
  readonly id: ExtrasTab;
  /** "Stories 3/10". */
  readonly label: string;
  /** "Stories": a phone's rail has no room for the count. */
  readonly name: string;
}

export interface ExtrasTileView {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly open: boolean;
  /** How to open a locked tile ("Beat Rhino"); null once open. */
  readonly hint: string | null;
  readonly thumb: Picture | null;
  /** The tile's call to action once open: READ, VIEW or PLAY. */
  readonly action: string;
  readonly entry: ExtrasEntry;
}

export function extrasTabsOf(extras: Extras): readonly ExtrasTabView[] {
  return EXTRAS_TABS.map((tab) => {
    const { open, total } = extras.countOf(EXTRAS_ENTRIES[tab.id]);
    return { id: tab.id, label: `${tab.label} ${open}/${total}`, name: tab.label };
  });
}

const actionOf = (entry: ExtrasEntry): string =>
  entry.content.kind === "issue" ? "READ" : entry.content.kind === "track" ? "PLAY" : "VIEW";

export function extrasTilesOf(extras: Extras, tab: ExtrasTab): readonly ExtrasTileView[] {
  return EXTRAS_ENTRIES[tab].map((entry) => {
    const open = extras.isOpen(entry.unlock);
    return {
      id: entry.id,
      title: entry.title,
      subtitle: entry.subtitle,
      open,
      hint: open ? null : unlockHint(entry.unlock),
      thumb: entry.thumb,
      action: actionOf(entry),
      entry,
    };
  });
}

/** "12 of 64 open", across every tab, for the top bar. */
export function extrasSummaryOf(extras: Extras): string {
  let open = 0;
  let total = 0;
  for (const tab of EXTRAS_TABS) {
    const count = extras.countOf(EXTRAS_ENTRIES[tab.id]);
    open += count.open;
    total += count.total;
  }
  return `${open} of ${total} open`;
}

export interface ExtrasGrid {
  readonly columns: number;
  readonly gap: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** One list row: a row of tiles plus the gap under it. */
  readonly rowHeight: number;
}

/** The narrowest a picture tile gets before the grid drops a column. */
const MIN_TILE_WIDTH = 168;
/** The caption strip under a tile's picture: title, subtitle or hint. */
const TILE_CAPTION = 52;
/** Music is a list, not a grid: one song per row. */
export const EXTRAS_TRACK_ROW = 60;

/** Picture tiles fill the width in as many columns as fit (two at least, so a phone still reads as a shelf). */
export function extrasGridOf(width: number, tab: ExtrasTab, phone: boolean): ExtrasGrid {
  const gap = phone ? 10 : 16;
  if (tab === "music") {
    return { columns: 1, gap: 0, tileWidth: width, tileHeight: EXTRAS_TRACK_ROW, rowHeight: EXTRAS_TRACK_ROW };
  }
  const columns = Math.max(2, Math.floor((width + gap) / (MIN_TILE_WIDTH + gap)));
  const tileWidth = Math.max(1, (width - gap * (columns - 1)) / columns);
  // Heroes and villains are portraits; stories and artwork are landscape panels.
  const pictureHeight = tab === "heroes" || tab === "villains" ? tileWidth * 1.1 : tileWidth * 0.62;
  const tileHeight = Math.round(pictureHeight + TILE_CAPTION);
  return { columns, gap, tileWidth, tileHeight, rowHeight: tileHeight + gap };
}

/** How many list rows `count` tiles take. */
export const extrasRowCount = (count: number, grid: ExtrasGrid): number => Math.ceil(count / grid.columns);

/** Tile `index`'s rect inside its list row, whose top-left is `row`. */
export function extrasTileRect(index: number, grid: ExtrasGrid, row: { readonly x: number; readonly y: number }): Rect {
  const column = index % grid.columns;
  return { x: row.x + column * (grid.tileWidth + grid.gap), y: row.y, width: grid.tileWidth, height: grid.tileHeight };
}

/** The tile under a tap at `x` in list row `rowIndex`, or null for a tap in a gap or past the last tile. */
export function extrasTileAt(
  x: number,
  rowIndex: number,
  grid: ExtrasGrid,
  listX: number,
  count: number,
): number | null {
  const offset = x - listX;
  const column = Math.floor(offset / (grid.tileWidth + grid.gap));
  if (column < 0 || column >= grid.columns) return null;
  if (offset - column * (grid.tileWidth + grid.gap) > grid.tileWidth) return null;
  const index = rowIndex * grid.columns + column;
  return index < count ? index : null;
}
