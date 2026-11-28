/**
 * Role-building's card list, as the parts of its own scroller: a "Recommended for you" group (a picture, a RECOMMENDED tag, the
 * name, a one-line reason, Inspect and Take) and then every other card as a grid of pictures with name, cost and aspect, and a
 * Take button each. A tap on a picture or its name reads the card in Inspect (which offers "Take this card"); only Take opens the
 * confirm step. Rows are laid out by `roleBuildRowsOf` (`view/campaign-role-build-model.ts`), so heights are known before drawing.
 * Stop keys: `rb-card:<id>` (the picture), `rb-take:<id>`, `rb-inspect:<id>`.
 */
import type { CardId } from "@mc/content";
import { artLanguageNow } from "../../../../art/art-source.js";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { accent, ink, surface, typeRole } from "../../../../tokens.js";
import { aspectStampOf } from "../../../../view/aspect-stamp.js";
import {
  BUTTON_HEIGHT,
  META_HEIGHT,
  NAME_HEIGHT,
  REC_ART_WIDTH,
  recRowHeight,
  roleBuildRowsOf,
  selectRoleBuildCard,
  type RoleBuildCardView,
  type RoleBuildView,
} from "../../../../view/campaign-role-build-model.js";
import type { Rect } from "../../../../view/layout.js";
import type { BriefingCtx, Column } from "../context.js";
import { drawPickArt } from "./pick-art.js";

const INSET = 4;

/** "Cost 2 · Justice": the cost in the player's language, then the aspect's name. */
export function costLineOf(card: RoleBuildCardView): string {
  const cost = card.cost === null ? t("briefing.call.costX") : t("briefing.call.cost", { cost: card.cost });
  return `${cost} · ${aspectStampOf(card.aspect.aspect, artLanguageNow()).label}`;
}

/** Opens a card in Inspect with its "Take this card" button (`mc-choice-toggle` comes back to the slot's `onInspectTake`). */
export const inspectToTake = (ctx: BriefingCtx, id: string): void =>
  ctx.inspectCard(id, { optionId: id, label: t("briefing.call.takeThis") });

/** The section label a `label` row reads, from the view's noun (`RECOMMENDED FOR YOU`, `ALL OTHER EVENTS`). */
function sectionLabel(view: RoleBuildView, kind: "recommended" | "rest" | "all"): string {
  if (kind === "recommended") return t("briefing.call.build.recommendedHeading");
  const key = kind === "rest" ? "others" : "all";
  return t(`briefing.call.build.${key}_${view.noun}` as "briefing.call.build.others_event");
}

/** Draws the list's rows into `b` (the scroller's own builder, x on screen and y from 0); returns where they end. */
export function drawRoleBuildRows(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  view: RoleBuildView,
  width: number,
): number {
  const { rows, heights, geometry } = roleBuildRowsOf(view, width);
  const take = (id: string): void => {
    ctx.state.roleBuild = selectRoleBuildCard(ctx.state.roleBuild, view, id);
    ctx.redraw();
  };
  const read = (id: string): void => inspectToTake(ctx, id);
  let y = 0;
  rows.forEach((row, index) => {
    const height = heights[index]!;
    const top = y;
    y += height;
    if (row.kind === "label") {
      const noun = view.recommended.length > 0 ? "rest" : "all";
      const text =
        index === 0 && view.recommended.length > 0 ? sectionLabel(view, "recommended") : sectionLabel(view, noun);
      b.text(col.x + INSET, top + height / 2, text.toLocaleUpperCase(), typeRole.label, {
        size: 11,
        color: surface.ink.hex,
        alpha: 0.7,
        origin: [0, 0.5],
      });
      return;
    }
    if (row.kind === "recommended") {
      drawRecommended(ctx, b, col, { x: col.x, y: top, width, height }, row.card, read, take);
      return;
    }
    row.cards.forEach((card, at) => {
      const cell: Rect = {
        x: col.x + INSET + at * (geometry.cellWidth + 8),
        y: top + 2,
        width: geometry.cellWidth,
        height: geometry.cellHeight - 4,
      };
      const art: Rect = { x: cell.x, y: cell.y, width: cell.width, height: geometry.artHeight };
      drawPickArt(ctx, b, col, art, { cardId: card.id as CardId, name: card.name }, `rb-card:${card.id}`, {
        badge: 26,
        onInspect: () => read(card.id),
      });
      const nameTop = art.y + art.height + 6;
      b.text(cell.x, nameTop, card.label, typeRole.rowTitle, {
        size: 11,
        color: surface.ink.hex,
        wrapWidth: cell.width,
        maxLines: 3,
      });
      b.text(cell.x, nameTop + NAME_HEIGHT, costLineOf(card), typeRole.body, {
        size: 10,
        color: surface.ink.hex,
        alpha: ink.secondary,
        wrapWidth: cell.width,
      });
      // The name and cost read the card too.
      const readable: Rect = { x: cell.x, y: nameTop, width: cell.width, height: NAME_HEIGHT + META_HEIGHT };
      b.tap(`rb-read:${card.id}`, readable, { inspect: true });
      ctx.actions.set(`rb-read:${card.id}`, () => read(card.id));
      ctx.inspects.set(`rb-read:${card.id}`, () => read(card.id));
      const button: Rect = {
        x: cell.x,
        y: nameTop + NAME_HEIGHT + META_HEIGHT + 4,
        width: cell.width,
        height: BUTTON_HEIGHT,
      };
      b.button({
        key: `rb-take:${card.id}`,
        rect: button,
        label: t("briefing.call.take"),
        look: "secondary",
        type: typeRole.label,
      });
      ctx.actions.set(`rb-take:${card.id}`, () => take(card.id));
    });
  });
  return y;
}

/** One recommended card: its picture, the RECOMMENDED tag, name, reason, and Inspect / Take. */
function drawRecommended(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  row: Rect,
  card: RoleBuildCardView,
  read: (id: string) => void,
  take: (id: string) => void,
): void {
  const art: Rect = { x: row.x + INSET, y: row.y + 8, width: REC_ART_WIDTH, height: recRowHeight() - 16 };
  drawPickArt(ctx, b, col, art, { cardId: card.id as CardId, name: card.name }, `rb-card:${card.id}`, {
    badge: 26,
    onInspect: () => read(card.id),
  });
  const textX = art.x + art.width + 12;
  const textWidth = row.x + row.width - 8 - textX;
  const tag = t("briefing.call.build.recommended").toLocaleUpperCase();
  const tagBox = b.measure(tag, typeRole.label, { size: 10 });
  b.box({ x: textX, y: art.y, width: tagBox.width + 12, height: 18 }, { fill: accent.heroRed.hex });
  b.text(textX + 6, art.y + 9, tag, typeRole.label, { size: 10, color: surface.paper.hex, origin: [0, 0.5] });
  const name = b.text(textX, art.y + 20, card.label, typeRole.rowTitle, {
    size: 14,
    color: surface.ink.hex,
    wrapWidth: textWidth,
    maxLines: 2,
  });
  b.text(textX, art.y + 20 + name.height + 2, card.reason ?? "", typeRole.body, {
    size: 11,
    color: surface.ink.hex,
    alpha: ink.secondary,
    wrapWidth: textWidth,
    maxLines: 3,
    lineSpacing: 1,
  });
  const buttonY = art.y + art.height - 40;
  const half = Math.floor((textWidth - 6) / 2);
  b.button({
    key: `rb-inspect:${card.id}`,
    rect: { x: textX, y: buttonY, width: half, height: 40 },
    label: t("decks.card.inspect"),
    look: "quiet",
    type: typeRole.label,
  });
  b.button({
    key: `rb-take:${card.id}`,
    rect: { x: textX + half + 6, y: buttonY, width: half, height: 40 },
    label: t("briefing.call.take"),
    look: "primary",
    type: typeRole.label,
  });
  ctx.actions.set(`rb-inspect:${card.id}`, () => read(card.id));
  ctx.actions.set(`rb-take:${card.id}`, () => take(card.id));
}
