import { ink, surface, typeRole } from "../../../tokens.js";
import { caseOf } from "../../../ui/theme.js";
import { type SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import type { Rect } from "../../../view/layout.js";
import { clipToView, revealDelta } from "../../../view/focus-list.js";
import { t } from "../../../i18n/translate.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import {
  TILE_GAP,
  VOLUME_ROW_HEIGHT,
  LIST,
  MORE_HEIGHT,
  CUSTOM_HEADER_HEIGHT,
  type VolumeTiles,
  type VolumeInline,
  type ShelfItem,
  type SagaCtx,
} from "./context.js";
import { drawTile, drawPhoneVolumeRow, drawCustomHeader } from "./tile.js";

/**
 * The volumes as a scrolling list, in tiles or (`tiles` null) the phone's rows, each a focus stop that scrolls into
 * view. A tap is the list's own (a tap area in its content): the end of a swipe is not one.
 */
export function drawVolumes(
  ctx: SagaCtx,
  b: SheetBuilder,
  listRect: Rect,
  tiles: VolumeTiles | null,
  inline?: VolumeInline,
): number {
  const tileWidth = tiles ? (listRect.width - TILE_GAP * (tiles.columns - 1)) / tiles.columns : 0;
  const columns = tiles?.columns ?? 1;
  const cellAt = (rowRect: Rect, column: number): Rect => ({
    x: rowRect.x + column * (tileWidth + TILE_GAP),
    y: rowRect.y,
    width: tileWidth,
    height: tiles?.height ?? 0,
  });
  // The base volumes, then (when a pack ships a campaign) a Custom campaigns header and those: rows of the list.
  const chunk = (rows: readonly SagaVolumeRow[]): ShelfItem[] =>
    Array.from({ length: Math.ceil(rows.length / columns) }, (_, i) => ({
      kind: "volumes" as const,
      rows: rows.slice(i * columns, (i + 1) * columns),
    }));
  const customRows = ctx.state.rows.filter((r) => r.volume.custom);
  const items: ShelfItem[] = [
    ...chunk(ctx.state.rows.filter((r) => !r.volume.custom)),
    ...(customRows.length > 0 ? [{ kind: "header" as const }, ...chunk(customRows)] : []),
  ];
  const rowHeight = tiles ? tiles.height + TILE_GAP : VOLUME_ROW_HEIGHT;
  const heightOf = (index: number): number => (items[index]?.kind === "header" ? CUSTOM_HEADER_HEIGHT : rowHeight);
  const tops: number[] = [];
  let total = 0;
  for (let index = 0; index < items.length; index++) {
    tops.push(total);
    total += heightOf(index);
  }
  // Where a content-space rect is on the screen now, the part of the screen the rows are seen in, and how a focused row
  // is brought into it: the list's own scroller, or (`inline`) the page's.
  const top0 = inline?.top ?? 0;
  const onScreen =
    inline?.onScreen ??
    ((content: Rect): Rect => {
      const scrolled = ctx.scroller()?.scrollTop ?? ctx.state.listTop;
      return { ...content, y: listRect.y + content.y - scrolled };
    });
  const view = inline?.view ?? ((): Rect => listRect);
  const reveal =
    inline?.reveal ??
    ((content: Rect): void => {
      const scroller = ctx.scroller();
      if (!scroller) return;
      const seen: Rect = { x: 0, y: scroller.scrollTop, width: listRect.width, height: listRect.height };
      const delta = revealDelta(content, seen);
      if (delta !== 0) scroller.scrollTop += delta;
    });
  if (!inline) {
    ctx.state.listRect = listRect;
    ctx.state.listContent = total;
    ctx.state.moreShown = ctx.moreNow();
  }

  const paint = (inner: SheetBuilder): void => {
    items.forEach((item, index) => {
      const rowRect: Rect = { x: listRect.x, y: top0 + tops[index]!, width: listRect.width, height: heightOf(index) };
      if (item.kind === "header") {
        drawCustomHeader(ctx, inner, rowRect);
        return;
      }
      item.rows.forEach((volumeRow, column) => {
        const rect = tiles ? cellAt(rowRect, column) : rowRect;
        if (tiles) drawTile(ctx, inner, volumeRow, rect);
        else drawPhoneVolumeRow(ctx, inner, volumeRow, rect);
        const key = `vol-${volumeRow.volume.number}`;
        inner.tap(key, rect);
        ctx.actions.set(key, () => ctx.feature(volumeRow.volume.number));
      });
    });
  };
  if (inline) paint(inline.into);
  else b.scroll(LIST, listRect, total, paint);
  if (!inline && ctx.state.moreShown) {
    b.text(
      listRect.x + listRect.width / 2,
      listRect.y + listRect.height + MORE_HEIGHT / 2,
      caseOf(typeRole.label, t("saga.moreVolumes")),
      typeRole.label,
      { color: surface.ink.hex, alpha: ink.meta, origin: [0.5, 0.5] },
    );
  }

  items.forEach((item, row) => {
    if (item.kind !== "volumes") return;
    item.rows.forEach((volumeRow, column) => {
      const contentRect = (): Rect => {
        const rowRect: Rect = { x: listRect.x, y: top0 + tops[row]!, width: listRect.width, height: heightOf(row) };
        return tiles ? cellAt(rowRect, column) : rowRect;
      };
      ctx.stops.set(`vol-${volumeRow.volume.number}`, {
        rect: () => clipToView(onScreen(contentRect()), view()),
        view,
        activate: () => ctx.feature(volumeRow.volume.number),
        ensureVisible: () => reveal(contentRect()),
      });
    });
  });
  return total;
}
