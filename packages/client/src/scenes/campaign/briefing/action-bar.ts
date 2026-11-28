/**
 * The ink action bar: EDIT DECKS (a phone's: DECKS) and the one red OPEN ISSUE button, the reason the issue cannot open yet
 * (a deck setup would refuse, or a call still to answer), the "Let people watch this game" toggle and a start error.
 * Returns where the content above it ends.
 */
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { accent, surface, typeRole } from "../../../tokens.js";
import { bangers, campaignFrame } from "../../../ui/campaign-chrome.js";
import { t } from "../../../i18n/translate.js";
import type { Rect } from "../../../view/layout.js";
import type { BriefingCtx } from "./context.js";
import { WATCH_STRIP_HEIGHT } from "./context.js";
import { openHintIn } from "./copy.js";
import { briefingTextIn } from "./copy.js";
import { cardNameOf } from "./names.js";

type Frame = ReturnType<typeof campaignFrame>;

/** A strip across the phone's width, just above the action bar, holding a line of words (the paper keeps scrolling content out of it). */
function drawStrip(b: SheetBuilder, frame: Frame, bar: Rect, text: string, color: number, size: number): void {
  const gutter = frame.gutter;
  const height = stripHeightOf(b, frame, { text, size });
  b.box({ x: 0, y: bar.y - height, width: frame.width, height }, { fill: surface.paper.hex });
  b.text(gutter, bar.y - height + 6, text, typeRole.label, { size, color, wrapWidth: frame.width - gutter * 2 });
}

/** The reason line beside a wide action bar's buttons, centred on the bar. */
function drawBeside(
  b: SheetBuilder,
  frame: Frame,
  bar: Rect,
  editRect: Rect,
  text: string,
  color: number,
  size: number,
): void {
  const width = editRect.x - frame.gutter - 16;
  const height = b.measure(text, typeRole.label, { size, wrapWidth: width }).height;
  b.text(frame.gutter, bar.y + (bar.height - height) / 2, text, typeRole.label, { size, color, wrapWidth: width });
}

/** The line the bar gives for why Open waits: a deck setup would refuse (outranks), or a call / composing hint. Null when none. */
function reasonLineOf(ctx: BriefingCtx): { readonly text: string; readonly size: number } | null {
  const { state } = ctx;
  const record = state.record;
  if (!record) return null;
  // Nothing is judged here: `deckProblems` is the engine's own verdict.
  const problems = ctx.deckProblems(record);
  const blockedSeat = [...problems.keys()][0];
  if (!!record.attempt && blockedSeat !== undefined) {
    const seat = record.seats.find((candidate) => candidate.seatNumber === blockedSeat);
    const who = seat ? cardNameOf(seat.identityCardId as string) : t("briefing.seatFallback", { number: blockedSeat });
    const reason = t("briefing.deckProblem", {
      who,
      problem: briefingTextIn().deckProblem(problems.get(blockedSeat) as string),
    });
    return { text: `! ${reason}`, size: 14 };
  }
  const hint = openHintIn({
    issueNumber: state.issueNumber,
    pending: !!state.pending,
    composing: state.composing,
    starting: state.starting,
    deckBlocked: false,
  });
  return hint ? { text: hint.bar, size: 15 } : null;
}

/** A strip's height for `line`: as tall as it wraps across the phone's width, with 6px above and below. */
function stripHeightOf(b: SheetBuilder, frame: Frame, line: { readonly text: string; readonly size: number }): number {
  return (
    b.measure(line.text, typeRole.label, { size: line.size, wrapWidth: frame.width - frame.gutter * 2 }).height + 12
  );
}

/**
 * How tall the phone's strip above the action bar is now (a reason line as tall as it wraps, the watch toggle, or none), so the
 * page's scroller and a call that fills the screen stop above it instead of running under it.
 */
export function phoneStripHeight(ctx: BriefingCtx, b: SheetBuilder, frame: Frame): number {
  if (!frame.phone || !ctx.state.record) return 0;
  const line = reasonLineOf(ctx);
  if (line) return stripHeightOf(b, frame, line);
  return !ctx.state.seatPicker && !ctx.state.inProgress ? WATCH_STRIP_HEIGHT : 0;
}

export function drawActionBar(ctx: BriefingCtx, b: SheetBuilder, frame: Frame): void {
  const { state } = ctx;
  const record = state.record;
  if (!record) return;
  const phone = frame.phone;
  const { width, gutter } = frame;
  const bar: Rect = { x: 0, y: frame.height - frame.actionBar, width, height: frame.actionBar };
  b.box(bar, { fill: surface.ink.hex });

  const editRect: Rect = phone
    ? { x: 12, y: bar.y + (bar.height - 48) / 2, width: (width - 12 * 3) / 2, height: 48 }
    : { x: width - 16 - 425 - 12 - 150, y: bar.y + (bar.height - 62) / 2, width: 150, height: 62 };
  const editDecks = (): void => ctx.editDecks();
  b.button({
    key: "edit-decks",
    rect: editRect,
    label: t(phone ? "briefing.edit.phone" : "briefing.edit").toLocaleUpperCase(),
    look: "onInk",
    type: bangers(16),
    row: true,
  });
  ctx.actions.set("edit-decks", editDecks);
  ctx.stops.set("edit-decks", { rect: editRect, activate: editDecks });
  ctx.obstacles.push(editRect);

  // A deck setup would refuse blocks the button up front, with the reason beside it; the edit button then goes to the
  // offending seat. Nothing is judged here: `deckProblems` is the engine's own verdict.
  const problems = ctx.deckProblems(record);
  const blockedSeat = [...problems.keys()][0];
  const blocked = !!record.attempt && blockedSeat !== undefined;
  const canOpen =
    !!record.attempt && !state.pending && !state.composing && !state.starting && !state.toggling && !blocked;
  const openRect: Rect = phone
    ? { x: 12 + editRect.width + 12, y: editRect.y, width: editRect.width, height: 48 }
    : { x: width - 16 - 425, y: editRect.y, width: 425, height: 62 };
  const label = state.starting
    ? t("briefing.opening")
    : blocked
      ? t("briefing.fixDeck")
      : t(state.inProgress ? "briefing.continue" : "briefing.open", { number: state.issueNumber });
  const open = (): void => {
    if (canOpen) ctx.openIssue();
  };
  b.button({
    key: "open",
    rect: openRect,
    label: label.toLocaleUpperCase(),
    look: "primary",
    type: bangers(phone ? 15 : 22),
    row: true,
    chevron: false,
    ...(canOpen ? {} : { disabled: true }),
  });
  ctx.actions.set("open", open);
  ctx.obstacles.push(openRect);
  if (canOpen) {
    ctx.stops.set("open", { rect: openRect, activate: open });
    if (!state.seatPicker && openRect.width >= 240) {
      ctx.glyphs.hint(b, {
        key: "open-forward",
        x: openRect.x + openRect.width - 24,
        y: openRect.y + openRect.height / 2,
        ids: ["pause"],
        idsNow: (set) => (set === "pad" ? ["pause"] : []),
        height: Math.min(26, Math.max(16, openRect.height - 24)),
        ground: "ink",
        alignRight: true,
      });
    }
  }

  // The reason Open waits (a deck problem outranks a call or composing hint): beside a wide bar's buttons, on a strip above a phone's.
  const line = reasonLineOf(ctx);
  if (line) {
    if (phone) drawStrip(b, frame, bar, line.text, accent.heroRed.hex, line.size);
    else drawBeside(b, frame, bar, editRect, line.text, accent.heroRed.hex, line.size);
  }
  // Right where the problem and hint lines go, so only one of them shows at a time: a problem outranks the toggle. Not for
  // an issue already on the table: its save keeps the choice it was dealt with, so the toggle would be ignored.
  if (!line && !state.seatPicker && !state.inProgress) {
    const area: Rect = phone
      ? { x: 0, y: bar.y - WATCH_STRIP_HEIGHT, width, height: WATCH_STRIP_HEIGHT }
      : { x: gutter, y: editRect.y, width: Math.min(380, editRect.x - gutter - 16), height: editRect.height };
    if (area.width >= 160) drawWatchToggle(ctx, b, area, phone);
  }
  if (state.startError) {
    b.text(gutter, bar.y - 20, state.startError, typeRole.label, { color: accent.heroRed.hex });
  }
}

/** "Let people watch this game" (#876): a checkbox line by the action bar; a phone's sits on a strip above it. */
function drawWatchToggle(ctx: BriefingCtx, b: SheetBuilder, area: Rect, strip: boolean): void {
  if (strip) b.box(area, { fill: surface.paper.hex });
  const hit: Rect = strip ? { x: 8, y: area.y, width: area.width - 16, height: area.height } : area;
  const toggle = (): void => {
    ctx.state.watchable = !ctx.state.watchable;
    ctx.redraw();
  };
  const size = 22;
  const bx = hit.x + 10;
  const by = hit.y + (hit.height - size) / 2;
  b.box({ x: bx, y: by, width: size, height: size }, { stroke: surface.ink.hex, strokeWidth: 2 });
  if (ctx.state.watchable) {
    b.poly(
      [
        [bx + 4, by + size / 2],
        [bx + size / 2 - 1, by + size - 5],
        [bx + size - 4, by + 5],
      ],
      { stroke: surface.ink.hex, strokeWidth: 3 },
    );
  }
  b.text(bx + size + 10, hit.y + hit.height / 2, t("live.setup.title"), typeRole.label, {
    color: surface.ink.hex,
    origin: [0, 0.5],
    fitWidth: hit.width - size - 30,
  });
  b.tap("watch", hit);
  ctx.actions.set("watch", toggle);
  ctx.stops.set("watch", { rect: hit, activate: toggle });
}
