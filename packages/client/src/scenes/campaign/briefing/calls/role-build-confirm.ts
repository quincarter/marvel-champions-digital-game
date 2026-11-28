/**
 * Role-building's confirm step: "Add Drop Kick to Colossus's deck?". The card's picture beside its name, cost, why it is
 * recommended (when it is) and what taking it does; only Confirm records the card, Back returns to the same place in the list,
 * Inspect reads the card. Drawn into the scroller's builder (`ROLE_CONFIRM_SCROLL`), so a short screen scrolls it.
 */
import type { CardId } from "@mc/content";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { ink, surface, typeRole } from "../../../../tokens.js";
import { bangers } from "../../../../ui/campaign-chrome.js";
import {
  backFromRoleBuild,
  confirmedRoleBuildCard,
  CARD_RATIO,
  type RoleBuildCardView,
  type RoleBuildView,
} from "../../../../view/campaign-role-build-model.js";
import type { Rect } from "../../../../view/layout.js";
import type { BriefingCtx, Column } from "../context.js";
import { drawConfirmBar } from "./confirm-bar.js";
import { drawPickArt } from "./pick-art.js";
import { costLineOf } from "./role-build-list.js";

/** Draws the step from `top` in `col` (the scroller's own column) and returns its bottom. */
export function drawRoleBuildConfirm(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  top: number,
  heroName: string,
  view: RoleBuildView,
  card: RoleBuildCardView,
): number {
  const phone = col.width < 560;
  const pad = 14;
  const inner = col.width - pad * 2;
  const title = b.text(
    col.x + pad,
    top + pad,
    t("briefing.call.build.confirmTitle", { card: card.name, hero: heroName }).toLocaleUpperCase(),
    bangers(phone ? 24 : 28),
    { color: surface.ink.hex, wrapWidth: inner },
  );
  const artWidth = phone ? 120 : 150;
  const art: Rect = {
    x: col.x + pad,
    y: top + pad + title.height + 10,
    width: artWidth,
    height: Math.round(artWidth / CARD_RATIO),
  };
  drawPickArt(ctx, b, col, art, { cardId: card.id as CardId, name: card.name }, "rb-confirm-art", { badge: 0 });
  const textX = art.x + artWidth + 14;
  const textWidth = col.x + col.width - pad - textX;
  let y = art.y;
  y +=
    b.text(textX, y, `${card.label}\n${costLineOf(card)}`, typeRole.emphasis, {
      size: 13,
      color: surface.ink.hex,
      wrapWidth: textWidth,
    }).height + 8;
  if (card.reason) {
    y +=
      b.text(textX, y, t("briefing.call.build.recommendedReason", { reason: card.reason }), typeRole.body, {
        size: 11,
        color: surface.ink.hex,
        alpha: ink.secondary,
        wrapWidth: textWidth,
      }).height + 8;
  }
  const detail = b.text(textX, y, t(`briefing.call.build.confirmDetail_${view.noun}`), typeRole.body, {
    size: 11,
    color: surface.ink.hex,
    alpha: ink.secondary,
    wrapWidth: textWidth,
  });
  const bottom = Math.max(art.y + art.height, y + detail.height) + pad;
  b.box({ x: col.x, y: top, width: col.width, height: bottom - top }, { stroke: surface.ink.hex, strokeWidth: 2 });
  const back = (): void => {
    ctx.state.roleBuild = backFromRoleBuild(ctx.state.roleBuild);
    ctx.redraw();
  };
  const accept = (): void => {
    const id = confirmedRoleBuildCard(ctx.state.roleBuild, view);
    if (id !== null) ctx.answer([id]);
  };
  const read = (): void => ctx.inspectCard(card.id);
  return drawConfirmBar(ctx, b, col, bottom + 12, {
    back: { key: "rb-back", run: back },
    confirm: { key: "rb-confirm", run: accept },
    read: { key: "rb-inspect", run: read },
  });
}
