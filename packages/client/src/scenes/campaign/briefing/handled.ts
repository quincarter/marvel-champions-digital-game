/**
 * The shared heading and note of the Briefing's blocks, and "Handled for you": one framed list of what setup did
 * automatically, with a green check for a step that happens this issue and a blue arrow for a value held for a later one.
 */
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { ink, signal, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { t } from "../../../i18n/translate.js";
import type { HandledRow } from "../../../view/campaign-briefing-model.js";
import type { WaitingPanel } from "../../../view/campaign-modular-call-model.js";
import type { BriefingCtx, Column } from "./context.js";
import { briefingTextIn, waitingNoteIn } from "./copy.js";

/** A "section heading ────" in the campaign's Bangers-and-rule style; returns the y under it. */
export function drawRuleHeading(
  b: SheetBuilder,
  x: number,
  y: number,
  width: number,
  text: string,
  color: number = surface.ink.hex,
  size = 20,
): number {
  const words = text.toLocaleUpperCase();
  const heading = b.text(x, y, words, bangers(size), { color });
  const ruleX = x + heading.width + 12;
  if (ruleX < x + width)
    b.box({ x: ruleX, y: y + heading.height / 2 - 1.5, width: x + width - ruleX, height: 3 }, { fill: color });
  return y + heading.height + 12;
}

/** What an unfilled panel says while the issue waits on a call, or is still composing; returns its height. */
export function drawWaiting(
  ctx: BriefingCtx,
  b: SheetBuilder,
  x: number,
  y: number,
  width: number,
  panel: WaitingPanel,
): number {
  const { pending, record } = ctx.state;
  const genre = !!pending && !!record && ctx.slots.call.isGenreSetPick?.(ctx, pending) === true;
  const text = waitingNoteIn(panel, pending ? "asking" : "composing", genre);
  return b.text(x, y, text, typeRole.body, { color: surface.ink.hex, alpha: ink.secondary, wrapWidth: width }).height;
}

const ROW_PAD = 12;
const GLYPH_ROOM = 48;
const CITATION_ROOM = 90;

/** The title's own type: the row-title role at 14. */
const TITLE = { size: 14 } as const;

function rowHeight(b: SheetBuilder, row: HandledRow, width: number): number {
  const title = b.measure(row.title, typeRole.rowTitle, {
    ...TITLE,
    wrapWidth: row.citation ? width - CITATION_ROOM : width,
  });
  const detail = row.detail.length > 0 ? b.measure(row.detail, typeRole.body, { wrapWidth: width }) : null;
  return 8 + title.height + (detail ? 2 + detail.height : 0) + ROW_PAD;
}

/** "Handled for you" at (`col.x`, `top`): returns its bottom. */
export function drawHandled(ctx: BriefingCtx, b: SheetBuilder, col: Column, top: number): number {
  const view = ctx.plan?.view ?? null;
  const x = col.x;
  const width = col.width;
  let y = drawRuleHeading(b, x, top, width, t("briefing.handled"));
  if (!view) return y + drawWaiting(ctx, b, x, y, width, "handled") + 8;
  if (view.handled.length === 0) {
    b.text(x, y, t("briefing.handled.none"), typeRole.label, { color: surface.ink.hex, alpha: ink.secondary });
    return y + 20;
  }
  const text = briefingTextIn();
  const rows = view.handled.map((row) => text.handledRow(row));
  const innerWidth = width - GLYPH_ROOM;
  const listTop = y;
  let cursor = y + 10;
  const placed = rows.map((row) => {
    const height = rowHeight(b, row, innerWidth);
    const at = cursor;
    cursor += height;
    return { row, y: at };
  });
  const listHeight = cursor - listTop + 10;
  b.box({ x, y: listTop, width, height: listHeight }, { stroke: surface.ink.hex, strokeWidth: 2 });
  placed.forEach(({ row, y: rowY }, index) => {
    if (index > 0) b.box({ x, y: rowY, width, height: 1 }, { fill: surface.ink.hex, fillAlpha: 0.2 });
    // The canvas: green check for this issue, blue arrow for a value held for a later one (never Hero Red, the CTA's).
    const glyphColor = row.status === "done" ? signal.heal.hex : signal.cost.hex;
    b.text(x + ROW_PAD, rowY + 10, row.status === "done" ? "✓" : "→", typeRole.rowTitle, {
      ...TITLE,
      color: glyphColor,
      origin: [0.5, 0],
    });
    const citationWidth = row.citation ? CITATION_ROOM : 0;
    const title = b.text(x + 36, rowY + 8, row.title, typeRole.rowTitle, {
      ...TITLE,
      color: surface.ink.hex,
      wrapWidth: width - GLYPH_ROOM - citationWidth,
    });
    if (row.citation) {
      b.text(x + width - ROW_PAD, rowY + 10, row.citation, typeRole.label, {
        size: 10,
        color: surface.ink.hex,
        alpha: 0.4,
        origin: [1, 0],
      });
    }
    // A one-sentence row (role-building) has no detail line, and an empty text would still hold a line's height.
    if (row.detail.length > 0) {
      b.text(x + 36, rowY + 8 + title.height + 2, row.detail, typeRole.body, {
        color: surface.ink.hex,
        alpha: ink.secondary,
        wrapWidth: innerWidth,
      });
    }
  });
  y = listTop + listHeight;
  return y;
}
