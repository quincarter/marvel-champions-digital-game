/**
 * A card's small picture in a row or a tile: the scan on a parchment ground (a "no scan" word while it loads or when there is
 * none), a press or hold that opens it in Inspect, and the desktop hover popover. Drawn through the calls' picture piece so a
 * section's pictures behave exactly as a call's do; a card with no id draws the plain frame and nothing to press.
 */
import type { CardId } from "@mc/content";
import type { SheetBuilder } from "../../../../../dom/sheet-builder.js";
import { t } from "../../../../../i18n/translate.js";
import { surface } from "../../../../../tokens.js";
import type { Rect } from "../../../../../view/layout.js";
import { drawPickArt } from "../../calls/pick-art.js";
import type { BriefingCtx, Column } from "../../context.js";

export function drawCardThumb(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  rect: Rect,
  card: { readonly cardId: CardId | null; readonly name: string },
  key: string,
  onInspect: (card: { readonly cardId: CardId; readonly name: string }) => void,
): void {
  if (card.cardId === null) {
    b.box(rect, { fill: surface.parchment.hex });
    b.box(rect, { stroke: surface.ink.hex, strokeWidth: 1, alpha: 0.6 });
    return;
  }
  drawPickArt(ctx, b, col, rect, { cardId: card.cardId, name: card.name }, key, {
    badge: 0,
    missing: t("briefing.pool.noScan"),
    onInspect,
  });
}
