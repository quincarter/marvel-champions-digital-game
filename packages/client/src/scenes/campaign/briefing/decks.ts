/**
 * The Decks panel: one row per seat ("HERO · ASPECT", the deck's count, a "▸"), each a way into that seat's own deck, and
 * the line under it. A row naming a problem wraps it under the hero in red with a "!" (never colour alone).
 */
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { accent, ink, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { t } from "../../../i18n/translate.js";
import { DECK_NOTE_EXEMPT, type BriefingView } from "../../../view/campaign-briefing-model.js";
import { deckRowLayout, deckRowTitleWidth } from "../../../view/campaign-deck-row-layout.js";
import type { BriefingCtx, Column } from "./context.js";
import { briefingTextIn } from "./copy.js";
import { drawRuleHeading, drawWaiting } from "./handled.js";

type DeckRow = BriefingView["decks"][number];

const countOf = (row: DeckRow): string =>
  row.pinnedCount > 0 ? t("briefing.decks.pinned", { size: row.deckSize, pinned: row.pinnedCount }) : `${row.deckSize}`;

/** The Decks panel at (`col.x`, `top`): returns its bottom. */
export function drawDecks(ctx: BriefingCtx, b: SheetBuilder, col: Column, top: number): number {
  const view = ctx.plan?.view ?? null;
  const { x, width } = col;
  const listTop = drawRuleHeading(b, x, top, width, t("briefing.decks"));
  if (!view) return listTop + drawWaiting(ctx, b, x, listTop, width, "decks");
  const text = briefingTextIn();
  // A row naming a problem wraps it under the hero, and a narrow panel drops the count to its own line, so the row
  // grows by a line instead of cutting the reason or printing the count over the name.
  const rows = view.decks.map((row) => ({
    row,
    count: countOf(row),
    title: `${row.heroName.toLocaleUpperCase()} · ${row.aspectLabel}`,
  }));
  const layouts = rows.map(({ row, count, title }) => deckRowLayout(width, title, count, !!row.problem));
  const total = layouts.reduce((sum, layout) => sum + layout.height, 0);
  b.box({ x, y: listTop, width, height: total }, { stroke: surface.ink.hex, strokeWidth: 2 });
  let rowTop = listTop;
  rows.forEach(({ row, count, title }, index) => {
    const layout = layouts[index]!;
    const top = rowTop;
    rowTop += layout.height;
    if (index > 0) b.box({ x, y: top, width, height: 1 }, { fill: surface.ink.hex, fillAlpha: 0.2 });
    if (row.problem)
      b.box(
        { x: x + 1, y: top + 1, width: width - 2, height: layout.height - 2 },
        { fill: accent.heroRed.hex, fillAlpha: 0.1 },
      );
    const nameY = top + layout.titleY;
    b.text(x + 12, nameY, title, bangers(16), {
      color: surface.ink.hex,
      origin: [0, 0.5],
      fitWidth: deckRowTitleWidth(width, count, layout.stacked),
    });
    b.text(x + width - 36, top + layout.countY, count, typeRole.rowTitle, {
      size: 14,
      color: surface.ink.hex,
      origin: [1, 0.5],
    });
    // The way into this seat's own deck, on every row: the arrow says the row is a button.
    b.text(x + width - 12, nameY, "▸", typeRole.rowTitle, { size: 18, color: surface.ink.hex, origin: [1, 0.5] });
    if (row.problem) {
      // Words as well as the red wash: the mark is a "!" in a shape-bearing label, never colour alone.
      b.text(x + 12, top + (layout.problemY ?? 36), `! ${text.deckProblem(row.problem)}`, typeRole.label, {
        size: 14,
        color: accent.heroRed.hex,
        wrapWidth: width - 24,
      });
    }
    const key = `deck-seat-${row.seatNumber}`;
    const content = { x, y: top, width, height: layout.height };
    b.tap(key, content);
    col.control(key, content, () => ctx.editDecks(row.seatNumber));
  });
  const noteY = listTop + total + 12;
  const note = b.text(x, noteY, text.deckNote(view.deckNote ?? DECK_NOTE_EXEMPT), typeRole.label, {
    letterSpacing: 0,
    color: surface.ink.hex,
    alpha: ink.label,
    wrapWidth: width,
  });
  return noteY + note.height;
}
