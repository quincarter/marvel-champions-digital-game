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

/** A narrow column's bar with a third button: Back, Inspect and Confirm in one row, so the bar is one button tall and can be pinned. */
export const COMPACT_BAR_HEIGHT = ROW_HEIGHT;
const compactBar = (model: ConfirmBarModel, width: number): boolean => !!model.read && width < 560;

/** Draws the bar at `top` and returns its bottom. */
export function drawConfirmBar(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  top: number,
  model: ConfirmBarModel,
): number {
  const compact = compactBar(model, col.width);
  const rects = confirmBarRects(col.x, top, col.width);
  let { back } = rects;
  let { confirm } = rects;
  let compactRead: Rect | null = null;
  if (compact) {
    const small = Math.floor((col.width - GAP * 2) * 0.27);
    const backRect: Rect = { x: col.x, y: top, width: small, height: ROW_HEIGHT };
    compactRead = { x: col.x + small + GAP, y: top, width: small + 8, height: ROW_HEIGHT };
    const confirmX = compactRead.x + compactRead.width + GAP;
    confirm = { x: confirmX, y: top, width: col.x + col.width - confirmX, height: ROW_HEIGHT };
    back = backRect;
  }
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
  const read: Rect = compactRead ?? { x: col.x, y: top + ROW_HEIGHT + 10, width: back.width, height: hit.target };
  b.button({
    key: model.read.key,
    rect: read,
    label: t("decks.card.inspect"),
    look: "quiet",
    type: typeRole.label,
  });
  col.control(model.read.key, read, model.read.run, { inspect: model.read.run });
  ctx.obstacles.push(read);
  return compact ? top + ROW_HEIGHT : read.y + read.height;
}
