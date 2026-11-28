/**
 * The Roster page as parts of its `mc-sheet`, from the top: the box art faded over the page, the top bar, the caption box
 * with the box's banner, the Team-Up strip and the four seat cards, the LOCKED / FREE note, and the ink action bar with the
 * one "Sign & open issue #1" button. The deck picker (`picker.ts`) is drawn over all of it while a seat's is open.
 */
import { currentCardsById } from "../../../content/pool.js";
import { drawCampaignPageArt, drawCaptionBox } from "../../../dom/campaign-page.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { sheetTopBar } from "../../../dom/sheet-top-bar.js";
import { storyFor } from "../../../campaign/story.js";
import { rosterBannerIn, rosterNoteIn } from "../../../campaign/campaign-text.js";
import { signal, surface, typeRole, ink, accent } from "../../../tokens.js";
import { bangers, campaignFrame } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { t } from "../../../i18n/translate.js";
import { deckReasonText } from "../../../view/deck-reason.js";
import { seatedTeamUps } from "../../../view/seat-recommendations.js";
import { PAIR_ROW_HEIGHT } from "../../../view/seats-layout.js";
import type { Rect } from "../../../view/layout.js";
import type { RosterCtx } from "./context.js";
import { rosterPairCatalog } from "./pairs.js";
import { drawPairStrip, drawSeat, phoneSeatRects, wideSeatRects } from "./seats.js";

/** The modes of this run, said after the title ("Expert · Balanced"): on the bar's right, where they keep their full words. */
function modesOf(ctx: RosterCtx): string {
  const { state } = ctx;
  return [
    ...(state.expertCampaign ? [t("roster.mode.expert")] : []),
    ...(state.balanced ? [t("campaign.balancedTag")] : []),
  ].join(" · ");
}

export function drawPage(ctx: RosterCtx, b: SheetBuilder, frame: ReturnType<typeof campaignFrame>): void {
  const { state } = ctx;
  const screen: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
  b.box(screen, { fill: surface.paper.hex });
  drawCampaignPageArt(b, ctx.leases, state.campaignId, screen);

  const top = sheetTopBar(b, ctx.glyphs, {
    scene: ctx.scene,
    frame,
    backLabel: frame.phone ? "◂" : t("roster.back"),
    title: t("roster.title"),
    right: modesOf(ctx),
  });
  if (top.backRect) {
    ctx.actions.set("back", () => ctx.onCancel());
    ctx.stops.set("back", { rect: top.backRect, activate: () => ctx.onCancel() });
  }

  const story = storyFor(state.campaignId);
  const gutter = frame.gutter;
  let y = top.height + gutter;
  // A box with no story file (MojoMania) has no banner to show: no empty caption box either.
  if (story) {
    const banner = drawCaptionBox(
      b,
      gutter,
      y,
      frame.width - gutter * 2,
      rosterBannerIn(state.campaignId, story.rosterBanner),
      13,
    );
    y += banner.height + gutter;
  }

  const actionBar: Rect = { x: 0, y: frame.height - frame.actionBar, width: frame.width, height: frame.actionBar };
  const seatsBottom = actionBar.y - gutter;

  // Seated Team-Up pairs: a strip above the seat cards, one row per pair, reserved only while there are some.
  state.phoneLayout = frame.phone;
  const pairs = seatedTeamUps(state.seats, currentCardsById(), rosterPairCatalog());
  state.pairs = pairs;
  const stripRows = Math.min(pairs.length, 3);
  const stripRect: Rect = { x: gutter, y, width: frame.width - gutter * 2, height: stripRows * PAIR_ROW_HEIGHT };
  if (stripRows > 0) y += stripRect.height + 6;

  const seatsHeight = seatsBottom - y - (frame.phone ? 96 : 60);
  const seatRects = frame.phone
    ? phoneSeatRects(gutter, y, frame.width - gutter * 2, seatsHeight)
    : wideSeatRects(gutter, y, frame.width - gutter * 2, seatsHeight);
  seatRects.forEach((rect, i) => drawSeat(ctx, b, i + 1, rect));
  if (stripRows > 0) drawPairStrip(ctx, b, stripRect, pairs, seatRects, y, frame.phone);

  drawNote(
    b,
    { x: gutter, y: seatsBottom - 52, width: frame.width - gutter * 2, height: 44 },
    frame.phone,
    story?.rosterNote,
    story !== undefined,
    state.campaignId,
  );

  b.box(actionBar, { fill: surface.ink.hex });
  drawSignButton(ctx, b, actionBar, frame.phone);
  if (state.error) b.text(gutter, actionBar.y - 20, state.error, typeRole.label, { color: accent.heroRed.hex });
}

/** The LOCKED / FREE note under the seats, and (wide) the box's note about its cast. */
function drawNote(
  b: SheetBuilder,
  rect: Rect,
  phone: boolean,
  rosterNote: string | undefined,
  hasStory: boolean,
  campaignId: string,
): void {
  b.box(
    { x: rect.x + 0.75, y: rect.y + 0.75, width: rect.width - 1.5, height: rect.height - 1.5 },
    { stroke: surface.ink.hex, strokeWidth: 1.5 },
  );
  const word = (text: string, y: number, color: number): number => {
    const label = caseOf(typeRole.rowTitle, text.toLocaleUpperCase());
    b.text(rect.x + 10, y, label, typeRole.rowTitle, { size: 11, color });
    return b.measure(label, typeRole.rowTitle, { size: 11 }).width;
  };
  const detail = (text: string, x: number, y: number): void => {
    b.text(x, y, text, typeRole.body, { size: 11, color: surface.ink.hex, alpha: ink.secondary });
  };
  const lockedWidth = word(t("roster.locked"), rect.y + 6, surface.ink.hex);
  detail(t("roster.lockedDetail"), rect.x + 10 + lockedWidth + 12, rect.y + 6);
  const freeWidth = word(t("roster.free"), rect.y + 22, signal.heal.hex);
  detail(t("roster.freeDetail"), rect.x + 10 + freeWidth + 12, rect.y + 22);
  if (!phone && hasStory) {
    const text = rosterNote === undefined ? t("roster.castNote") : rosterNoteIn(campaignId, rosterNote);
    b.text(rect.x + 320, rect.y + 6, caseOf(typeRole.label, text), typeRole.label, {
      size: 10,
      color: surface.ink.hex,
      alpha: ink.meta,
      wrapWidth: rect.width - 330,
    });
  }
}

/** "Sign & open issue #1", in the action bar. Start and Enter press it; a pad shows Start beside its word. */
function drawSignButton(ctx: RosterCtx, b: SheetBuilder, actionBar: Rect, phone: boolean): void {
  const { state } = ctx;
  const model = state.model;
  const width = phone ? actionBar.width - 24 : Math.min(360, actionBar.width - 32);
  const rect: Rect = {
    x: actionBar.x + actionBar.width - 16 - width,
    y: actionBar.y + (actionBar.height - 52) / 2,
    width,
    height: 52,
  };
  const enabled = model?.canSign === true && !state.signing;
  b.button({
    key: "cta",
    rect,
    label: (state.signing ? t("roster.signing") : t("roster.sign")).toLocaleUpperCase(),
    look: "primary",
    type: bangers(16),
    row: true,
    chevron: !state.signing,
    ...(enabled ? {} : { disabled: deckReasonText(model?.blockedReason ?? null) ?? true }),
  });
  ctx.actions.set("cta", () => {
    if (enabled) ctx.onSign();
  });
  ctx.stops.set("cta", { rect, activate: () => ctx.onSign() });
  ctx.obstacles.push(rect);
  if (state.pickerSeat === null && enabled && rect.width >= 240) {
    ctx.glyphs.hint(b, {
      key: "cta-forward",
      x: rect.x + rect.width - 40,
      y: rect.y + rect.height / 2,
      ids: ["pause"],
      idsNow: (set) => (set === "pad" ? ["pause"] : ["activate"]),
      height: Math.min(26, Math.max(16, rect.height - 24)),
      ground: "ink",
      alignRight: true,
    });
  }
}
