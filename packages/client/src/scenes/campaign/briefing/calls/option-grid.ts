/**
 * A plain pick of options (single or multi): one button per option in a wrapped grid that pages when it is long, each option
 * beside its card picture when every option is a card (the picture opens Inspect and answers nothing; the option's own button
 * takes it). A single pick answers on the press; a multi pick toggles and Confirm (enabled once exactly `count` are chosen)
 * submits them. An optional pick adds Decline. Stop keys: `call-option:<index>`, `call-inspect:<index>`, `call-prev` /
 * `call-next` (LB / RB turn the pages), `call-confirm`, `call-decline`.
 */
import { CAMPAIGN_ACCEPT } from "@mc/engine";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import { packNameOf } from "../../../../content/pool.js";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { issueTitleIn } from "../../../../campaign/campaign-text.js";
import { issueStoryFor } from "../../../../campaign/story.js";
import { ink, surface, typeRole } from "../../../../tokens.js";
import { CARD_OPTION_GRID, cardOptionCell, type PickCard } from "../../../../view/campaign-briefing-model.js";
import { callGridOf, callLabelWidthOf } from "../../../../view/campaign-call-layout.js";
import { optionLabelsOf } from "../../../../view/campaign-option-labels.js";
import type { Rect } from "../../../../view/layout.js";
import type { BriefingCtx, Column } from "../context.js";
import { cardNameOf } from "../names.js";
import { optionLabelIn } from "./call-text.js";
import type { CallInput, CallKind } from "./calls.types.js";
import { drawPickArt } from "./pick-art.js";

type OptionsKind = Extract<CallKind, { kind: "options" }>;

const BUTTON_ROW = 44;
const BUTTON_WIDTH = 160;
const ROW_STEP = 56;

/** A Decline button (answers with no pick), quiet, at (`x`, `y`): the optional pick's way out. */
export function drawDecline(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  rect: Rect,
  look: "quiet" | "secondary" = "quiet",
  label = t("prompt.decline"),
): void {
  b.button({ key: "call-decline", rect, label, look, type: typeRole.label });
  col.control("call-decline", rect, () => ctx.answer([]));
  ctx.obstacles.push(rect);
}

/** The accept / decline pair of a random-draw call ("Take it" / "Decline"). */
export function drawAcceptDecline(input: CallInput, top: number): number {
  const { ctx, b, col } = input;
  const decline: Rect = { x: col.x, y: top, width: BUTTON_WIDTH, height: BUTTON_ROW };
  const accept: Rect = { x: col.x + BUTTON_WIDTH + 12, y: top, width: BUTTON_WIDTH, height: BUTTON_ROW };
  drawDecline(ctx, b, col, decline, "secondary");
  b.button({
    key: "call-accept",
    rect: accept,
    label: t("briefing.call.accept"),
    look: "primary",
    type: typeRole.label,
  });
  col.control("call-accept", accept, () => ctx.answer([CAMPAIGN_ACCEPT]));
  ctx.obstacles.push(accept);
  return top + BUTTON_ROW;
}

/** The labels the options wear: a card's name (plus what tells two apart), a scenario's title, the villain-method words. */
export function optionLabelsFor(ctx: BriefingCtx, options: readonly string[]): ReadonlyMap<string, string> {
  const record = ctx.state.record;
  const base = optionLabelsOf(
    options,
    (id) => campaignCardsById().get(id),
    packNameOf,
    (id) => {
      // A scenario a choice graph offers (Fear No Evil) is billed by its issue title, in the player's language.
      const title = record ? issueStoryFor(record.campaignId as string, id)?.title : undefined;
      return title === undefined ? undefined : issueTitleIn(record!.campaignId as string, id, title);
    },
  );
  return new Map(options.map((id) => [id, optionLabelIn(id, base.get(id) ?? cardNameOf(id))]));
}

/** Draws the option grid, its pager, Confirm and Decline from `top`; returns the bottom. */
export function drawOptionGrid(input: CallInput, top: number, kind: OptionsKind): number {
  const { ctx, b, col, pending } = input;
  const state = ctx.state;
  const labels = optionLabelsFor(ctx, pending.options);
  const cards = kind.cards;
  const reserved =
    (pending.options.length > 24 ? ROW_STEP : 0) + ROW_STEP + (pending.count > 1 && pending.optional ? ROW_STEP : 0);
  const grid = callGridOf({
    count: pending.options.length,
    x: col.x,
    y: top,
    width: col.width,
    maxHeight: Math.max(BUTTON_ROW * 4, col.view.height - 200 - reserved),
    page: state.callPage,
    ...(cards ? CARD_OPTION_GRID : { fitWidth: callLabelWidthOf(pending.options.map((id) => labels.get(id) ?? "")) }),
  });
  pending.options.slice(grid.firstIndex, grid.firstIndex + grid.rects.length).forEach((optionId, shown) => {
    const index = grid.firstIndex + shown;
    const cell = grid.rects[shown]!;
    const card: PickCard | undefined = cards?.get(optionId);
    const split = card ? cardOptionCell(cell, card.shape) : null;
    const rect: Rect = split ? split.button : cell;
    if (card && split) drawPickArt(ctx, b, col, split.art, card, `call-inspect:${index}`);
    const selected = state.picking.includes(optionId);
    const toggle = (): void => {
      if (pending.count <= 1) {
        ctx.answer([optionId]);
        return;
      }
      state.picking = selected ? state.picking.filter((id) => id !== optionId) : [...state.picking, optionId];
      ctx.redraw();
    };
    const key = `call-option:${index}`;
    b.button({
      key,
      rect,
      label: labels.get(optionId) ?? optionId,
      look: "secondary",
      type: typeRole.label,
      ...(selected ? { selected: true } : {}),
    });
    col.control(key, rect, toggle);
    ctx.obstacles.push(rect);
  });
  let below = grid.bottom + 12;
  if (grid.pageCount > 1) below = drawPager(input, below, grid.page, grid.pageCount);
  if (pending.count > 1) {
    const rect: Rect = { x: col.x, y: below, width: BUTTON_WIDTH, height: BUTTON_ROW };
    const ready = state.picking.length === pending.count;
    b.button({
      key: "call-confirm",
      rect,
      label: t("briefing.call.confirm"),
      look: "primary",
      type: typeRole.label,
      ...(ready ? {} : { disabled: true }),
    });
    ctx.obstacles.push(rect);
    if (ready) {
      col.control("call-confirm", rect, () => ctx.answer(state.picking));
      ctx.glyphs.hint(b, {
        key: "call-confirm-forward",
        x: rect.x + rect.width - 12,
        y: rect.y + rect.height / 2,
        ids: ["pause"],
        idsNow: (set) => (set === "pad" ? ["pause"] : []),
        height: 22,
        ground: "ink",
        alignRight: true,
      });
    }
  }
  let bottom = below + (pending.count > 1 ? BUTTON_ROW : 0);
  if (pending.optional) {
    const y = below + (pending.count > 1 ? ROW_STEP : 0);
    drawDecline(ctx, b, col, { x: col.x, y, width: BUTTON_WIDTH, height: BUTTON_ROW });
    bottom = y + BUTTON_ROW;
  }
  return bottom;
}

/** The Prev / Next buttons and "Page 1 of 3" under a long list; returns the y under them. */
function drawPager(input: CallInput, top: number, page: number, pages: number): number {
  const { ctx, b, col } = input;
  const turn = (by: number): void => {
    ctx.state.callPage = Math.min(Math.max(page + by, 0), pages - 1);
    ctx.redraw();
  };
  const prev: Rect = { x: col.x, y: top, width: 130, height: BUTTON_ROW };
  const next: Rect = { x: col.x + 142, y: top, width: 130, height: BUTTON_ROW };
  b.button({
    key: "call-prev",
    rect: prev,
    label: t("briefing.call.prev"),
    look: "quiet",
    type: typeRole.label,
    ...(page > 0 ? {} : { disabled: true }),
  });
  b.button({
    key: "call-next",
    rect: next,
    label: t("briefing.call.next"),
    look: "quiet",
    type: typeRole.label,
    ...(page < pages - 1 ? {} : { disabled: true }),
  });
  if (page > 0) col.control("call-prev", prev, () => turn(-1));
  if (page < pages - 1) col.control("call-next", next, () => turn(1));
  b.text(col.x + 290, top + BUTTON_ROW / 2, t("briefing.call.page", { page: page + 1, pages }), typeRole.label, {
    color: surface.ink.hex,
    alpha: ink.secondary,
    origin: [0, 0.5],
    fitWidth: Math.max(40, col.width - 290),
  });
  ctx.obstacles.push(prev, next);
  return top + ROW_STEP;
}
