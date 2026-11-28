/**
 * A quiet full-size button that opens one card in Inspect: the "Inspect" chip on a mission row, a carried-in card's name. A
 * press opens the card and answers nothing. It is its own focus stop, with Inspect on the stop for a pad's hold.
 */
import type { SheetBuilder } from "../../../../../dom/sheet-builder.js";
import { typeRole } from "../../../../../tokens.js";
import type { Rect } from "../../../../../view/layout.js";
import type { BriefingCtx, Column } from "../../context.js";

export function drawInspectChip(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  rect: Rect,
  label: string,
  key: string,
  open: () => void,
  size = 11,
): void {
  b.button({ key, rect, label, look: "quiet", type: { ...typeRole.label, size } });
  ctx.inspects.set(key, open);
  col.control(key, rect, open, { inspect: open });
  ctx.obstacles.push(rect);
}
