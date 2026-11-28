/**
 * The Back / Confirm bar under a confirm step (the role's, a role-building card's): only Confirm records the answer, Back
 * returns to the choice. An optional quiet third button (Inspect) sits under them. Confirm is the screen's forward button, so
 * it carries the pad's Start glyph and its stop is one of `FORWARD_STOPS`.
 */
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { hit, typeRole } from "../../../../tokens.js";
import type { Rect } from "../../../../view/layout.js";
import type { BriefingCtx, Column } from "../context.js";
import type { ConfirmBarModel } from "./calls.types.js";

const ROW_HEIGHT = 48;
const GAP = 12;

/** The bar's two button rects in a column `width` wide starting at (`x`, `y`). */
export function confirmBarRects(x: number, y: number, width: number): { back: Rect; confirm: Rect } {
  const buttonWidth = Math.min(180, Math.floor((width - GAP) / 2));
  return {
    back: { x, y, width: buttonWidth, height: ROW_HEIGHT },
    confirm: { x: x + buttonWidth + GAP, y, width: buttonWidth, height: ROW_HEIGHT },
  };
}

/** Draws the bar at `top` and returns its bottom. */
export function drawConfirmBar(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  top: number,
  model: ConfirmBarModel,
): number {
  const { back, confirm } = confirmBarRects(col.x, top, col.width);
  b.button({ key: model.back.key, rect: back, label: t("common.back"), look: "secondary", type: typeRole.label });
  b.button({
    key: model.confirm.key,
    rect: confirm,
    label: t("briefing.call.confirm"),
    look: "primary",
    type: typeRole.label,
  });
  col.control(model.back.key, back, model.back.run);
  col.control(model.confirm.key, confirm, model.confirm.run);
  ctx.obstacles.push(back, confirm);
  if (confirm.width >= 150) {
    ctx.glyphs.hint(b, {
      key: `${model.confirm.key}-forward`,
      x: confirm.x + confirm.width - 12,
      y: confirm.y + confirm.height / 2,
      ids: ["pause"],
      idsNow: (set) => (set === "pad" ? ["pause"] : []),
      height: 22,
      ground: "ink",
      alignRight: true,
    });
  }
  if (!model.read) return top + ROW_HEIGHT;
  const read: Rect = { x: col.x, y: top + ROW_HEIGHT + 10, width: back.width, height: hit.target };
  b.button({
    key: model.read.key,
    rect: read,
    label: t("decks.card.inspect"),
    look: "quiet",
    type: typeRole.label,
  });
  col.control(model.read.key, read, model.read.run, { inspect: model.read.run });
  ctx.obstacles.push(read);
  return read.y + read.height;
}
