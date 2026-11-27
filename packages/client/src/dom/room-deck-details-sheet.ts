/**
 * The room deck picker's details panel (#880; Quin, 2026-11-21) as the parts of a Lit sheet: one deck's hero picture,
 * names, stats and card list above a fixed footer of "Use this deck", "Edit deck" and "Close". The same drawing is the
 * desktop's slide-out and a phone's full sheet; the scene decides where it sits (`view/room-deck-picker-layout.ts`),
 * mounts it as its own region and slides that region in. The body scrolls; the footer never does.
 *
 * This is the Phaser `ui/room-deck-details-panel.ts` laid out the same way: the same rects, type, colors and order,
 * built through `SheetBuilder` instead of drawn into the canvas.
 */
import type Phaser from "phaser";
import { currentCardsById } from "../content/pool.js";
import { t, tPlural } from "../i18n/translate.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { CHIP_GAP, wrapChipsToRows } from "../view/chip-layout.js";
import type { DeckListGroup } from "../view/deck-stats.js";
import type { DeckDetails } from "../view/room-deck-details-model.js";
import type { Rect } from "../view/layout.js";
import type { PackLeases } from "../art/pack-art.js";
import { heroPictureOf } from "./hero-picture.js";
import { SheetBuilder } from "./sheet-builder.js";

const PAD = 14;
/** The room a scrolling body's scrollbar takes. */
const SCROLLBAR_ROOM = 12;
/** The footer: padding, the primary action, a gap, the second row, padding. */
export const DETAILS_FOOTER_HEIGHT = PAD + hit.primary + 8 + hit.target + PAD;

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;

/** The key of the body's scrolling region in the sheet. */
export const DETAILS_BODY = "details-body";

export interface DetailsSheetOptions {
  readonly game: Phaser.Game;
  readonly desktop: () => boolean;
  /** Where the panel rests, in screen coordinates. */
  readonly rect: Rect;
  readonly details: DeckDetails;
  readonly leases: PackLeases;
}

export interface DetailsFooterStop {
  readonly key: string;
  readonly rect: Rect;
}

export interface DetailsSheet {
  /** The sheet's parts, in `rect`'s own coordinates. */
  readonly nodes: SheetBuilder["nodes"];
  /** The masked body, at rest, in screen coordinates: the hover popover clips its card faces to it. */
  readonly body: Rect;
  /** Card faces in the body: the hero picture and each card line, `x` in screen coordinates and `y` from the body's top. */
  readonly faces: readonly { readonly cardId: string; readonly rect: Rect }[];
  /** The footer's buttons, in the order they are walked. */
  readonly stops: readonly DetailsFooterStop[];
}

/** Draws the body into `b` (its own content space: `y` from 0, `x` the screen's); returns the content's height. */
function drawBody(
  b: SheetBuilder,
  body: Rect,
  column: number,
  details: DeckDetails,
  leases: PackLeases,
  faces: { cardId: string; rect: Rect }[],
): number {
  let y = 0;

  const artHeight = Math.round(Math.min(200, Math.max(110, column * 0.5)));
  const artRect: Rect = { x: body.x, y, width: column, height: artHeight };
  const picture = heroPictureOf(currentCardsById().get(details.cardId), leases);
  b.image(artRect, {
    src: picture.src,
    fill: signal.spent.hex,
    cover: picture.cover,
    ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
  });
  b.box(artRect, { stroke: INK, strokeWidth: border.detail });
  faces.push({ cardId: details.cardId, rect: artRect });
  y += artHeight + 10;

  const name = b.text(body.x, y, details.title, typeRole.rowTitle, { size: 20, color: INK, wrapWidth: column });
  y += name.height + 2;
  const who = [details.heroName, details.aspects].filter((p) => p !== "").join(" · ");
  const line = b.text(body.x, y, who, typeRole.body, { size: 14, color: INK, alpha: ink.secondary, fitWidth: column });
  y += line.height + 2;
  const counts = [details.countText, details.averageCostText].filter((p): p is string => p !== null).join(" · ");
  const countLine = b.text(body.x, y, counts, typeRole.body, {
    size: 12,
    color: INK,
    alpha: ink.secondary,
    fitWidth: column,
  });
  y += countLine.height + 2;
  // The deck's standing, in words: never a colour alone.
  const status = details.checking
    ? t("room.picker.checking")
    : !details.seatable
      ? t("room.picker.notReady", { reason: details.blockedReason ?? "" })
      : details.current
        ? t("room.picker.current")
        : null;
  if (status) {
    const s = b.text(body.x, y, status, { ...typeRole.body, weight: 700 }, { size: 12, color: INK, wrapWidth: column });
    y += s.height + 2;
  }
  if (details.missing > 0) {
    const m = b.text(body.x, y, tPlural("room.picker.missing", details.missing), typeRole.body, {
      size: 12,
      color: INK,
      alpha: ink.secondary,
      wrapWidth: column,
    });
    y += m.height + 2;
  }
  y += 10;

  b.text(body.x, y, t("room.picker.statsHeading"), typeRole.label, { color: INK, alpha: ink.label });
  y += 16;
  const chart = 84;
  drawCurve(b, { x: body.x, y, width: column, height: chart }, details);
  y += chart + 10;
  if (details.tiles.length > 0) y = drawTiles(b, body.x, y, column, details) + 2;
  y += 6;

  b.text(body.x, y, t("room.picker.cardsHeading"), typeRole.label, { color: INK, alpha: ink.label });
  y += 16;
  y = drawGroups(b, body.x, y, column, details.groups, faces);
  y += CHIP_GAP;
  return y;
}

/** The cost curve: ink bars, the deck's most common printed costs in Hero Red, each with its cost under it. */
function drawCurve(b: SheetBuilder, rect: Rect, details: DeckDetails): void {
  const bars = details.curve;
  const gap = 6;
  const barWidth = (rect.width - gap * (bars.length - 1)) / bars.length;
  const maxCount = Math.max(1, ...bars.map((bar) => bar.count));
  const topCounts = new Set(
    [...new Set(bars.map((bar) => bar.count))]
      .filter((count) => count > 0)
      .sort((a, c) => c - a)
      .slice(0, 2),
  );
  bars.forEach((bar, index) => {
    const barHeight = Math.max(2, Math.round((bar.count / maxCount) * (rect.height - 18)));
    const x = rect.x + index * (barWidth + gap);
    const highlighted = topCounts.has(bar.count);
    const top = rect.y + (rect.height - 18 - barHeight);
    b.box(
      { x, y: top, width: barWidth, height: barHeight },
      {
        fill: highlighted ? accent.heroRed.hex : INK,
        ...(highlighted ? {} : { stroke: INK, strokeWidth: 2 }),
      },
    );
    b.text(x + barWidth / 2, rect.y + rect.height - 10, bar.label, typeRole.label, {
      color: INK,
      alpha: ink.label,
      origin: [0.5, 0],
    });
  });
}

/** Composition tiles ("Events 12"): a wrapped row of boxed counts. Returns the next free `y`. */
function drawTiles(b: SheetBuilder, left: number, top: number, width: number, details: DeckDetails): number {
  const tiles = details.tiles.map((tile) => ({ id: tile.id, text: `${tile.label} ${tile.count}` }));
  let y = top;
  for (const row of wrapChipsToRows(tiles, width)) {
    const cellWidth = (width - (row.length - 1) * CHIP_GAP) / Math.max(1, row.length);
    row.forEach((tile, index) => {
      const rect: Rect = { x: left + index * (cellWidth + CHIP_GAP), y, width: cellWidth, height: hit.target };
      b.box(rect, { fill: surface.card.hex, stroke: INK, strokeWidth: border.object });
      b.text(rect.x + rect.width / 2, rect.y + rect.height / 2, tile.text, typeRole.rowTitle, {
        color: INK,
        alpha: ink.body,
        origin: [0.5, 0.5],
      });
    });
    y += hit.target + CHIP_GAP;
  }
  return y;
}

/** The cards grouped as in the builder, a line each with its copies at the right. Returns the next free `y`. */
function drawGroups(
  b: SheetBuilder,
  left: number,
  top: number,
  column: number,
  groups: readonly DeckListGroup[],
  faces: { cardId: string; rect: Rect }[],
): number {
  let y = top;
  for (const group of groups) {
    if (group.entries.length === 0) continue;
    b.text(left, y, `${group.label} · ${group.count}`, typeRole.label, { color: INK, alpha: ink.meta });
    y += 14;
    for (const entry of group.entries) {
      const rowTop = y;
      b.text(left, y, entry.name, typeRole.body, { color: INK, fitWidth: column - 40 });
      b.text(left + column - 10, y, String(entry.quantity), typeRole.label, {
        color: INK,
        alpha: ink.secondary,
        origin: [1, 0],
      });
      y += 16;
      faces.push({
        cardId: entry.cardId as string,
        rect: { x: left, y: rowTop, width: column - 4, height: y - rowTop },
      });
    }
    y += 4;
  }
  return y + 8;
}

/** The panel as sheet parts at `options.rect`: its frame, the scrolling body and the footer buttons. */
export function buildDetailsSheet(options: DetailsSheetOptions): DetailsSheet {
  const { details, leases } = options;
  const r = options.rect;
  const b = new SheetBuilder(options.game, { x: r.x, y: r.y }, options.desktop);
  b.box(r, { fill: PAPER });
  b.box({ x: r.x + 1.5, y: r.y + 1.5, width: r.width - 3, height: r.height - 3 }, { stroke: INK, strokeWidth: 3 });

  const footerTop = r.y + r.height - DETAILS_FOOTER_HEIGHT;
  const body: Rect = {
    x: r.x + PAD,
    y: r.y + PAD,
    width: r.width - PAD * 2,
    height: Math.max(0, footerTop - r.y - PAD * 1.5),
  };
  const column = body.width - SCROLLBAR_ROOM;
  const faces: { cardId: string; rect: Rect }[] = [];
  // The content's height is needed before the region is made: laid out once on a scratch builder to read it.
  const scratch = new SheetBuilder(options.game, { x: body.x, y: 0 }, options.desktop);
  const used = drawBody(scratch, body, column, details, leases, []);
  const height = Math.max(body.height, used);
  b.scroll(DETAILS_BODY, { x: body.x, y: body.y, width: column, height: body.height }, height, (inner) => {
    drawBody(inner, body, column, details, leases, faces);
  });

  const left = r.x + PAD;
  const width = r.width - PAD * 2;
  const useRect: Rect = { x: left, y: footerTop + PAD, width, height: hit.primary };
  const second: Rect = { x: left, y: useRect.y + hit.primary + 8, width, height: hit.target };
  const type = { ...typeRole.label, size: 13 };
  const stops: DetailsFooterStop[] = [];
  const button = (key: string, rect: Rect, label: string, look: "primary" | "secondary", extra = {}): void => {
    b.button({ key, rect, label, look, type, ...extra });
    stops.push({ key, rect });
  };
  button("panel:use", useRect, t("room.picker.use"), details.seatable ? "primary" : "secondary", {
    ...(details.seatable ? {} : { disabled: details.blockedReason ?? (true as const), pressable: true }),
  });
  if (details.edit) {
    const half = (width - 8) / 2;
    button(
      "panel:edit",
      { ...second, width: half },
      details.edit.copy ? t("room.picker.editCopy") : t("room.picker.edit"),
      "secondary",
    );
    button("panel:close", { ...second, x: left + half + 8, width: half }, t("room.picker.close"), "secondary");
  } else {
    button("panel:close", second, t("room.picker.close"), "secondary");
  }
  return { nodes: b.nodes, body, faces, stops };
}
