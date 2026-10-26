/**
 * LT / RT page the focused shelf row on Scenario select and Take your seats, the same as its ‹ / › chevrons. The
 * glyphs sit in each chevron's gutter above the chevron, for the row focus is in, and only while that row can go that
 * way and a pad is in use (`ui/glyph-hints.ts`).
 */

import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import type { PadLayer } from "../view/pad-layer-bindings.js";
import type { GlyphHints } from "../ui/glyph-hints.js";
import type { Rect } from "../view/layout.js";

/** The part of `McShelfRoster` the hints read (any item type). */
export interface PagingRoster {
  readonly rect: Rect;
  canPageShelf(shelfIndex: number, direction: 1 | -1): boolean;
  chevronRectFor(shelfIndex: number, direction: 1 | -1): Rect;
}

export interface RowPaging {
  readonly roster: () => PagingRoster | null;
  /** The shelf row focus is in now, or null when focus is not on a card of one. */
  readonly shelfIndex: () => number | null;
}

const LAYER_OF: Readonly<Record<"-1" | "1", PadLayer>> = { "-1": "lt", "1": "rt" };

/** Registers the two glyphs; call after `hints.reset()` on every redraw. */
export function shelfPagingHints(hints: GlyphHints, paging: RowPaging): void {
  for (const direction of [-1, 1] as const) {
    const layer = LAYER_OF[String(direction) as "-1" | "1"];
    const target = (): { roster: PagingRoster; shelf: number } | null => {
      const roster = paging.roster();
      const shelf = paging.shelfIndex();
      if (!roster || shelf === null || !roster.canPageShelf(shelf, direction)) return null;
      return { roster, shelf };
    };
    hints.custom(
      (set, snapshot) => {
        if (set !== "pad" || target() === null) return null;
        const spec = layerTriggerGlyph(layer, snapshot.state, snapshot.settings);
        return spec ? [spec] : null;
      },
      18,
      ({ width, height }) => {
        const found = target();
        if (!found) return null;
        const rect = found.roster.chevronRectFor(found.shelf, direction);
        const view = found.roster.rect;
        const y = rect.y - height / 2 - 6;
        if (y - height / 2 < view.y || y + height / 2 > view.y + view.height) return null;
        return { x: rect.x + (rect.width - width) / 2, y };
      },
      { ground: "paper" },
    );
  }
}
