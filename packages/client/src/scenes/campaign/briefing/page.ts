/**
 * The Briefing page as parts of its `mc-sheet`: the box art faded over the page, the top bar, the two layouts, the action
 * bar and the "which deck?" chooser over all of it.
 *
 * - **Phone**: one scrolling page from under the top bar to the action bar (the watch strip, when it shows, stops the
 *   scroll above it): the speaker, the handled rows or the pool, the sections, the call, then the decks (or, with a pool, the
 *   handled rows) on a coloured pane with a paper panel, across the page's foot.
 * - **Wide**: the left column (speaker, handled rows or pool, call), scrolling on its own when it runs long, and the coloured
 *   right pane flush to the right edge with a paper panel hugging the decks and sections, scrolling on its own.
 *
 * While the pending call scrolls itself (role-building's list) the page and the left column do not scroll.
 */
import { drawCampaignPageArt, drawPaneGround, drawPanePaper } from "../../../dom/campaign-page.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { sheetTopBar } from "../../../dom/sheet-top-bar.js";
import { t } from "../../../i18n/translate.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import { campaignFrame } from "../../../ui/campaign-chrome.js";
import { balancedTagOf } from "../../../view/campaign-balanced-model.js";
import { hiddenEvidenceEnvelope } from "../../../view/campaign-hidden-evidence-model.js";
import type { Rect } from "../../../view/layout.js";
import { drawActionBar } from "./action-bar.js";
import { makeColumn } from "./column.js";
import {
  LEFT_SCROLL,
  PAGE_SCROLL,
  RIGHT_SCROLL,
  SCROLL_GUTTER,
  WATCH_STRIP_HEIGHT,
  type BriefingBlock,
  type BriefingCtx,
  type BriefingPlan,
  type Column,
} from "./context.js";
import { briefingTextIn, hiddenMarkerIn } from "./copy.js";
import { drawDecks } from "./decks.js";
import { drawHandled } from "./handled.js";
import { cardNameOf } from "./names.js";
import { drawSeatPicker } from "./seat-picker.js";
import { drawSpeaker } from "./speaker.js";
import { briefingViewFor } from "./view-of.js";

type Frame = ReturnType<typeof campaignFrame>;

/** Runs `block` at `top + gap`; the stack's bottom moves only when the block drew something. */
function stack(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  bottom: number,
  gap: number,
  block: BriefingBlock,
): number {
  const top = bottom + gap;
  const next = block(ctx, b, col, top);
  return next > top ? next : bottom;
}

export function drawPage(ctx: BriefingCtx, b: SheetBuilder, frame: Frame): void {
  const { state } = ctx;
  const record = state.record;
  if (!record) return;
  const screen: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
  b.box(screen, { fill: surface.paper.hex });
  drawCampaignPageArt(b, ctx.leases, record.campaignId as string, screen);

  const hidden = state.definition ? hiddenEvidenceEnvelope(record, state.definition, cardNameOf) : null;
  const modes = [
    ...(record.modes.campaign?.expertCampaign ? [t("roster.mode.expert")] : []),
    ...(balancedTagOf(record.modes) ? [t("campaign.balancedTag")] : []),
  ];
  const top = sheetTopBar(b, ctx.glyphs, {
    scene: ctx.scene,
    frame,
    // Not under the "which deck?" chooser's scrim: its stops replace the route, so the glyph goes with them.
    backLabel: frame.phone ? "◂" : t("briefing.back"),
    title: [t("briefing.title", { number: state.issueNumber }), ...modes].join(" · "),
    ...(hidden ? { right: hiddenMarkerIn(hidden, briefingTextIn()) } : {}),
  });
  if (top.backRect) {
    ctx.actions.set("back", () => ctx.back());
    ctx.stops.set("back", { rect: top.backRect, activate: () => ctx.back() });
  }

  const view = briefingViewFor(ctx);
  const pending = state.pending;
  const shape = pending ? ctx.slots.call.shape(ctx, pending, frame.phone) : { seatCall: false, ownsScroll: false };
  const plan: BriefingPlan = {
    phone: frame.phone,
    view,
    hasPool: !!view?.pool,
    seatCall: shape.seatCall || shape.ownsScroll,
    callOwnsScroll: shape.ownsScroll,
  };
  ctx.plan = plan;
  const actionTop = frame.height - frame.actionBar;
  // A phone's watch strip sits above the action bar, so the scroller stops short of it: no control lies over a scroller.
  const scrollBottom = actionTop - (frame.phone ? WATCH_STRIP_HEIGHT : 0);
  if (frame.phone) drawPhone(ctx, b, frame, top.height, scrollBottom);
  else drawWide(ctx, b, frame, top.height, actionTop);

  drawActionBar(ctx, b, frame);
  if (state.seatPicker) drawSeatPicker(ctx, b, frame);
  ctx.plan = null;
}

/** The call, or a line saying the issue is being composed. */
function drawCallOrComposing(ctx: BriefingCtx, b: SheetBuilder, col: Column, bottom: number): number {
  if (ctx.state.pending) return stack(ctx, b, col, bottom, 20, ctx.slots.call.draw);
  if (!ctx.state.composing) return bottom;
  const y = bottom + 20;
  const line = b.text(col.x, y, t("briefing.composing"), typeRole.label, {
    color: surface.ink.hex,
    alpha: ink.secondary,
  });
  return y + line.height;
}

/** The speaker, then the pool or the handled rows, then the sections and the call: the column both layouts share. */
function drawStory(ctx: BriefingCtx, b: SheetBuilder, col: Column, top: number, withMain: boolean): number {
  const { plan, slots } = { plan: ctx.plan!, slots: ctx.slots };
  let bottom = top;
  if (!plan.seatCall) {
    bottom = drawSpeaker(ctx, b, col, top);
    bottom = stack(ctx, b, col, bottom, 20, plan.hasPool ? slots.sections.pool : drawHandled);
    if (withMain) bottom = stack(ctx, b, col, bottom, 20, slots.sections.main);
  }
  return drawCallOrComposing(ctx, b, col, bottom);
}

function drawPhone(ctx: BriefingCtx, b: SheetBuilder, frame: Frame, topHeight: number, scrollBottom: number): void {
  const plan = ctx.plan!;
  const { width, gutter } = frame;
  const campaignId = ctx.state.record!.campaignId as string;
  const view: Rect = { x: 0, y: topHeight, width: width - SCROLL_GUTTER, height: scrollBottom - topHeight };
  const scrolls = !plan.callOwnsScroll;
  const col = makeColumn(ctx, {
    x: gutter,
    width: width - gutter * 2,
    phone: true,
    view,
    scrollKey: scrolls ? PAGE_SCROLL : null,
  });
  const content = (inner: SheetBuilder): number => {
    const start = inner.nodes.length;
    let bottom = drawStory(ctx, inner, col, col.origin + 20, true);
    // Role-building takes the whole screen: its own list scrolls, and the decks are one EDIT DECKS press away.
    if (plan.callOwnsScroll) return bottom;
    const paneKind = plan.hasPool && !plan.seatCall ? "handled" : "decks";
    const paneTop = bottom + 20;
    const paneBottom = (paneKind === "handled" ? drawHandled : drawDecks)(ctx, inner, col, paneTop);
    bottom = Math.max(paneBottom, paneTop);
    // The coloured pane runs 20 above the content (the gap above it) and 16 below; the paper hugs the content.
    const pad = 12;
    const pane: Rect = { x: 0, y: paneTop - 20, width: view.width, height: bottom - paneTop + 20 + 16 };
    const before = inner.nodes.length;
    drawPaneGround(inner, ctx.leases, campaignId, pane, start);
    drawPanePaper(
      inner,
      { x: gutter - pad, y: paneTop - 12, width: width - (gutter - pad) * 2, height: bottom - paneTop + 12 + 4 },
      start + (inner.nodes.length - before),
    );
    return pane.y + pane.height;
  };
  if (scrolls) b.scrollFit(PAGE_SCROLL, view, content);
  else content(b);
}

function drawWide(ctx: BriefingCtx, b: SheetBuilder, frame: Frame, topHeight: number, actionTop: number): void {
  const plan = ctx.plan!;
  const { width, gutter } = frame;
  const campaignId = ctx.state.record!.campaignId as string;
  const columnGap = 32;
  const leftWidth = Math.round((width - gutter * 2 - columnGap) * 0.58);
  const contentBottom = actionTop - 16;
  const leftView: Rect = { x: gutter, y: topHeight + 20, width: leftWidth, height: contentBottom - (topHeight + 20) };
  const paneX = gutter + leftWidth + columnGap / 2;
  // The right column sits on the coloured pane (flush right, top bar to action bar). Its ink text sits on a paper panel
  // that hugs the content, with the pane's own inset around it (28 on a tablet, 40 wide), so the colour and the art show below it.
  const inset = width >= 1000 ? 40 : 28;
  const paperPad = 16;
  const paperX = paneX + inset;
  const paperWidth = width - paperX - inset;
  const paperTop = topHeight + inset;
  const rightView: Rect = {
    x: paperX + paperPad,
    y: paperTop + paperPad,
    width: paperWidth - paperPad * 2,
    height: contentBottom - (paperTop + paperPad),
  };
  drawPaneGround(b, ctx.leases, campaignId, {
    x: paneX,
    y: topHeight,
    width: width - paneX,
    height: actionTop - topHeight,
  });

  const left = makeColumn(ctx, {
    x: leftView.x,
    width: leftView.width,
    phone: false,
    view: leftView,
    scrollKey: plan.callOwnsScroll ? null : LEFT_SCROLL,
  });
  // The scheme, mission, shield and easier start sit beside the decks (right) unless a pool fills this column.
  const leftContent = (inner: SheetBuilder): number => drawStory(ctx, inner, left, left.origin, plan.hasPool);
  if (plan.callOwnsScroll) leftContent(b);
  else b.scrollFit(LEFT_SCROLL, leftView, leftContent);

  const right = makeColumn(ctx, {
    x: rightView.x,
    width: rightView.width,
    phone: false,
    view: rightView,
    scrollKey: RIGHT_SCROLL,
  });
  const paperAt = b.nodes.length;
  let used = 0;
  b.scrollFit(RIGHT_SCROLL, rightView, (inner) => {
    used = (plan.hasPool ? drawHandled : drawDecks)(ctx, inner, right, 0);
    used = stack(ctx, inner, right, used, 24, ctx.slots.sections.aside);
    return used;
  });
  // The paper hugs the content; a column that scrolls gets one as tall as its window, outside the scroll.
  const bottom = rightView.y + Math.min(used, rightView.height);
  drawPanePaper(b, { x: paperX, y: paperTop, width: paperWidth, height: bottom + paperPad - paperTop }, paperAt);
}
