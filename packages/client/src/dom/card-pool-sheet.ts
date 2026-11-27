/**
 * The card pool as `mc-sheet` parts: a windowed grid of card pictures (Card view) or a list of rows (List view), each
 * card with its scan, name, caption or rules, an optional −/quantity/+ strip, and tap areas that open Inspect. The deck
 * builder and the Decks screen share it, so a pool looks and behaves the same in both.
 *
 * - **Windowed.** Only the rows near the viewport are parts (`poolWindowKey`), so a pool of thousands of cards stays
 *   light. The scene redraws when a scroll changes the window (`CardPoolLayout.window`).
 * - **Plain data in.** A card arrives as a `CardPoolCard`, already worded: the rules (what a campaign refuses, what a
 *   rule setting forbids) stay with the scene, which also owns every action. The keys it draws are the stops' and the
 *   e2e's: `open:<id>` (tap, hold and right-click inspect), `minus:<id>`, `plus:<id>`, `cell:<id>` / `row:<id>`.
 * - **Hover.** `CardPoolLayout.faceRect` gives each card's picture-and-text box for the card hover popover.
 */
import { accent, hit, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { poolCellRect } from "../view/deck-pool-grid.js";
import type { Rect } from "../view/layout.js";
import type { CardPoolButton, CardPoolCard, CardPoolLayout, CardPoolModel } from "./card-pool-sheet.types.js";
import type { SheetBuilder } from "./sheet-builder.js";

/** Card view: the −, quantity and + strip under each cell's caption. */
export const POOL_GRID_CONTROLS_HEIGHT = hit.target + 8;
/** List view: the −, quantity and + at a row's right end. */
export const POOL_ROW_CONTROLS_WIDTH = 146;
/** Rows built above and below the viewport, so a scroll shows pictures already in place. */
export const POOL_OVERSCAN_ROWS = 2;
/** Lines of rules text a list row shows before the ellipsis; Inspect has the rest. */
export const POOL_CARD_TEXT_LINES = 3;

/** The small label type in the case it is written in (a type line, a note, rules text). */
const SENTENCE_LABEL: TypeSpec = { ...typeRole.label, uppercase: false };

/**
 * The rows drawn for a scroll offset, as a key: `start-end-count`, or "" with no rows. A scroll that leaves the key
 * unchanged needs no redraw.
 */
export function poolWindowKey(rowHeight: number, rowCount: number, viewHeight: number, scrollTop: number): string {
  if (rowHeight <= 0 || rowCount <= 0) return "";
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - POOL_OVERSCAN_ROWS);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewHeight) / rowHeight) + POOL_OVERSCAN_ROWS);
  return `${start}-${end}-${rowCount}`;
}

/** The card cell or row rect for `index`, in the list's content space. */
function cellRectFor(model: CardPoolModel, rowHeight: number, index: number): Rect {
  const { geometry, rect } = model;
  if (!geometry) return { x: rect.x, y: index * rowHeight, width: rect.width, height: rowHeight };
  const row = Math.floor(index / geometry.columns);
  const at: Rect = { x: rect.x, y: row * rowHeight, width: rect.width, height: rowHeight };
  return poolCellRect(geometry, at, index % geometry.columns);
}

/** Draws the pool's window into `b` and says where everything is. `b` is the sheet the list sits in. */
export function drawCardPool(b: SheetBuilder, model: CardPoolModel): CardPoolLayout {
  const { geometry, rect } = model;
  const rowHeight = geometry ? geometry.cellHeight : model.listRow.height;
  const rowCount = geometry ? geometry.rows : model.count;
  const window = poolWindowKey(rowHeight, rowCount, rect.height, model.scrollTop);
  const layout: CardPoolLayout = {
    rowHeight,
    rowCount,
    window,
    cellRect: (index) => cellRectFor(model, rowHeight, index),
    faceRect: (index) => {
      const cell = cellRectFor(model, rowHeight, index);
      return geometry
        ? {
            x: cell.x + 4,
            y: cell.y + 2,
            width: cell.width - 8,
            height: geometry.cellHeight - POOL_GRID_CONTROLS_HEIGHT - 4,
          }
        : { x: cell.x + 4, y: cell.y, width: cell.width - 8 - POOL_ROW_CONTROLS_WIDTH, height: rowHeight - 6 };
    },
  };
  if (window === "") return layout;
  const [start, end] = window.split("-").map(Number) as [number, number];
  if (!geometry) b.box(rect, { stroke: surface.ink.hex, strokeWidth: 2 });
  b.scroll(model.key, rect, rowCount * rowHeight, (inner) => {
    for (let row = start; row < end; row++) {
      if (geometry) {
        const first = row * geometry.columns;
        const inRow = Math.min(geometry.columns, model.count - first);
        for (let col = 0; col < inRow; col++) gridCell(inner, model, model.cardAt(first + col), first + col, layout);
      } else {
        listRow(inner, model, model.cardAt(row), row, layout);
      }
    }
  });
  return layout;
}

/** A card's "−" and "+" as parts. */
function quantityButtons(
  b: SheetBuilder,
  card: CardPoolCard,
  minusRect: Rect,
  plusRect: Rect,
  controls: NonNullable<CardPoolCard["controls"]>,
): void {
  const button = (key: string, rect: Rect, label: string, spec: CardPoolButton): void =>
    b.button({
      key,
      rect,
      label,
      look: "secondary",
      type: typeRole.rowTitle,
      aria: spec.aria,
      ...(spec.disabled !== undefined ? { disabled: spec.disabled } : {}),
    });
  button(`minus:${card.cardId}`, minusRect, "−", controls.minus);
  button(`plus:${card.cardId}`, plusRect, "+", controls.plus);
}

/** One cell of Card view, in the list's content space. */
function gridCell(
  b: SheetBuilder,
  model: CardPoolModel,
  card: CardPoolCard,
  index: number,
  layout: CardPoolLayout,
): void {
  const geometry = model.geometry!;
  const cell = layout.cellRect(index);
  const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 6 };
  const cardId = card.cardId;
  const framed = card.quantity > 0 || card.shown === true;
  b.box(cardRect, {
    fill: surface.card.hex,
    stroke: framed ? accent.heroRed.hex : surface.ink.hex,
    strokeWidth: framed ? 4 : 2,
    key: `cell:${cardId}`,
  });
  const artRect: Rect = {
    x: cardRect.x + 3,
    y: cardRect.y + 3,
    width: cardRect.width - 6,
    height: geometry.artHeight - 6,
  };
  b.image(artRect, {
    src: card.imageUrl,
    fill: surface.parchment.hex,
    missing: card.missing,
    key: `art:${cardId}`,
  });
  if (card.cost !== null) {
    const pipWidth = String(card.cost).length * 7 + 12;
    b.box(
      { x: artRect.x, y: artRect.y, width: pipWidth, height: 18 },
      { fill: surface.ink.hex, key: `cost-tab:${cardId}` },
    );
    b.text(artRect.x + 6, artRect.y + 9, String(card.cost), typeRole.label, {
      color: surface.paper.hex,
      origin: [0, 0.5],
      key: `cost:${cardId}`,
    });
  }
  const captionY = cardRect.y + geometry.artHeight;
  b.text(cardRect.x + 6, captionY, card.title, typeRole.rowTitle, {
    color: surface.ink.hex,
    fitWidth: cardRect.width - 12,
    key: `name:${cardId}`,
  });
  b.text(cardRect.x + 6, captionY + b.typeSize(11) * 1.25 + 2, card.caption, typeRole.label, {
    color: surface.ink.hex,
    alpha: card.captionStrong ? ink.label : ink.meta,
    fitWidth: cardRect.width - 12,
    key: `caption:${cardId}`,
  });
  // A tap on the picture or caption opens Inspect (a hold or a right-click does too).
  b.tap(`open:${cardId}`, layout.faceRect(index), { inspect: true });
  if (!card.controls) return;
  const stripY = cell.y + geometry.cellHeight - POOL_GRID_CONTROLS_HEIGHT;
  const buttonWidth = Math.min(44, (cardRect.width - 12) / 3);
  const minusRect: Rect = { x: cardRect.x + 4, y: stripY, width: buttonWidth, height: hit.target };
  const plusRect: Rect = {
    x: cardRect.x + cardRect.width - 4 - buttonWidth,
    y: stripY,
    width: buttonWidth,
    height: hit.target,
  };
  quantityButtons(b, card, minusRect, plusRect, card.controls);
  b.text(
    cardRect.x + cardRect.width / 2,
    stripY + hit.target / 2,
    card.quantity > 0 ? `×${card.quantity}` : "",
    typeRole.rowTitle,
    {
      color: surface.ink.hex,
      ...(card.quantity > 0 ? {} : { alpha: ink.meta }),
      origin: [0.5, 0.5],
      key: `qty:${cardId}`,
    },
  );
}

/** One row of List view: the picture, name, type line, why it is offered, its rules text, and the −, quantity and +. */
function listRow(
  b: SheetBuilder,
  model: CardPoolModel,
  card: CardPoolCard,
  index: number,
  layout: CardPoolLayout,
): void {
  const rect = layout.cellRect(index);
  const cardId = card.cardId;
  const { thumbWidth } = model.listRow;
  const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 8, height: model.listRow.height - 6 };
  b.box(row, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 2, key: `row:${cardId}` });
  b.image(
    { x: row.x + 6, y: row.y + 6, width: thumbWidth, height: row.height - 12 },
    { src: card.imageUrl, fill: surface.parchment.hex, missing: card.missing, key: `art:${cardId}` },
  );
  const textX = row.x + 6 + thumbWidth + 10;
  const controlsWidth = card.controls ? POOL_ROW_CONTROLS_WIDTH : 0;
  const textWidth = row.x + row.width - controlsWidth - textX;
  b.text(textX, row.y + 6, card.title, typeRole.rowTitle, {
    color: surface.ink.hex,
    fitWidth: textWidth,
    key: `name:${cardId}`,
  });
  const nameH = b.typeSize(11) * 1.25;
  const labelH = b.typeSize(9) * 1.2;
  const typeY = row.y + 6 + nameH + 2;
  b.text(textX, typeY, card.typeLine, SENTENCE_LABEL, {
    color: surface.ink.hex,
    alpha: ink.meta,
    fitWidth: textWidth,
    key: `type:${cardId}`,
  });
  // Why the card is offered or refused: its own line, so the type line never cuts it off on a narrow row.
  let belowY = typeY + labelH;
  if (card.note) {
    b.text(textX, belowY + 1, card.note, SENTENCE_LABEL, {
      color: surface.ink.hex,
      alpha: ink.label,
      fitWidth: textWidth,
      key: `note:${cardId}`,
    });
    belowY += labelH + 1;
  }
  if (card.rules) {
    b.text(textX, belowY + 4, card.rules, SENTENCE_LABEL, {
      color: surface.ink.hex,
      wrapWidth: textWidth,
      maxLines: card.note ? POOL_CARD_TEXT_LINES - 1 : POOL_CARD_TEXT_LINES,
      key: `rules:${cardId}`,
    });
  }
  if (!card.controls) {
    b.tap(`open:${cardId}`, { x: row.x, y: row.y, width: row.width, height: row.height }, { inspect: true });
    return;
  }
  b.text(row.x + row.width - 128, row.y + row.height / 2, String(card.quantity), typeRole.rowTitle, {
    color: surface.ink.hex,
    origin: [0.5, 0.5],
    key: `qty:${cardId}`,
  });
  b.tap(
    `open:${cardId}`,
    { x: row.x, y: row.y, width: row.width - POOL_ROW_CONTROLS_WIDTH - 4, height: row.height },
    { inspect: true },
  );
  const minusRect: Rect = {
    x: row.x + row.width - 106,
    y: row.y + (row.height - hit.target) / 2,
    width: 40,
    height: hit.target,
  };
  const plusRect: Rect = { x: row.x + row.width - 46, y: minusRect.y, width: 40, height: hit.target };
  quantityButtons(b, card, minusRect, plusRect, card.controls);
}
