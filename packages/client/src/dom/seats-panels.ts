/**
 * Take your seats' fixed parts as parts of an `mc-sheet` (`scenes/seats.ts`): the four seat cards (or the compact chips
 * a narrow screen has), the Team-Up bracket under them, the active seat's summary line, and the ink detail panel. Each
 * keeps the numbers the Phaser screen drew with, so the screen reads where it did; nothing here decides anything.
 * Words arrive already translated, and a press is a tap area the scene gives a key (`b.tap`), never a bare listener.
 */
import { accent, border, ink, surface, typeRole } from "../tokens.js";
import { teamUpArtFor, TEAM_UP_ART } from "../art/team-up-art.js";
import type { Rect } from "../view/layout.js";
import { pairBracketsOf, pairPillRect, type PairBracket, type SeatFrame } from "../view/seats-panel-model.js";
import type { SheetBuilder } from "./sheet-builder.js";

/** The ✕ that clears a filled seat card: a real touch target tucked into the card's top right corner. */
export const SEAT_CLEAR_SIZE = 28;
const CARD_PAD = 8;

const inset = (rect: Rect, by: number): Rect => ({
  x: rect.x + by,
  y: rect.y + by,
  width: rect.width - by * 2,
  height: rect.height - by * 2,
});

/** A seat's face and frame: the card ground (dimmed where the seat cannot be reached yet) and the frame its state calls for. */
function seatFace(b: SheetBuilder, rect: Rect, frame: SeatFrame, wide: boolean): void {
  const dim = frame === "locked" ? ink.illegal : 1;
  b.box(rect, { fill: surface.card.hex, fillAlpha: dim });
  const heavy = wide ? 4 : 3;
  if (frame === "activeEmpty")
    b.box(inset(rect, heavy / 2), { stroke: accent.heroRed.hex, strokeWidth: heavy, dashed: true });
  else if (frame === "empty" || frame === "locked")
    b.box(inset(rect, 1), { stroke: surface.ink.hex, strokeWidth: 2, dashed: true, alpha: dim });
  else if (frame === "activeFilled") b.box(inset(rect, heavy / 2), { stroke: accent.heroRed.hex, strokeWidth: heavy });
  else b.box(inset(rect, 0.75), { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: ink.label });
}

export interface SeatCardArgs {
  readonly rect: Rect;
  readonly index: number;
  /** The deck seated here, which the ✕ names so a press clears that deck and no other. */
  readonly deckId: string | null;
  readonly frame: SeatFrame;
  /** The seat label ("SEAT 1 · YOU", "SEAT 2 · PICKING"). */
  readonly label: string;
  readonly name: string | null;
  /** "Justice · 14 HP · hand 5". */
  readonly meta: string | null;
  /** What an empty card says ("Empty — pick a hero", "Fill seat 3 first"). */
  readonly empty: string | null;
  /** The identity card's scan for the thumbnail. */
  readonly picture: { readonly src: string | null; readonly retry?: string } | null;
  /** The ✕'s accessible name; a filled card has one. */
  readonly clearLabel: string | null;
}

/**
 * One seat card (the wide layout): a portrait thumbnail, the red seat label, the Bangers hero name, a meta line, a heavy
 * red frame when active, dashed when empty (the active empty seat red), dimmed when it cannot be reached yet. A reachable
 * seat takes a press (`seat:<index>`); a filled one carries its ✕ (`seat-clear:<deck id>`). The frame is the state's shape:
 * solid, dashed and thin are told apart without the color.
 */
export function drawSeatCard(b: SheetBuilder, a: SeatCardArgs): void {
  const { rect, frame } = a;
  const dim = frame === "locked" ? ink.illegal : 1;
  const filled = frame === "filled" || frame === "activeFilled";
  seatFace(b, rect, frame, true);
  // Capped relative to the card's own width as well as its height: at a 2x2 grid's ~180px card a height-driven thumbnail
  // left less than half the card for any text at all.
  const thumbSize = Math.min(rect.height - CARD_PAD * 2, rect.width * 0.32);
  const thumb: Rect = { x: rect.x + CARD_PAD, y: rect.y + CARD_PAD, width: thumbSize, height: thumbSize };
  if (filled && a.picture) {
    b.image(thumb, {
      src: a.picture.src,
      fill: surface.parchment.hex,
      cover: { x: 0.5, y: 0.3 },
      key: `seat-thumb:${a.index}`,
      ...(a.picture.retry !== undefined ? { retry: a.picture.retry } : {}),
    });
  }
  const textX = thumb.x + thumb.width + 10;
  const textWidth = rect.x + rect.width - textX - CARD_PAD;
  // Only the top two lines leave room for the ✕; the meta line at the card's foot is well clear of it.
  const topWidth = filled ? textWidth - SEAT_CLEAR_SIZE - 4 : textWidth;
  b.text(textX, rect.y + CARD_PAD, a.label, typeRole.label, {
    color: accent.heroRed.hex,
    alpha: dim,
    fitWidth: topWidth,
  });
  if (filled) {
    b.text(textX, rect.y + 26, a.name ?? "?", typeRole.sectionHeader, {
      size: 18,
      color: surface.ink.hex,
      fitWidth: topWidth,
    });
    if (a.meta)
      b.text(textX, rect.y + rect.height - 34, a.meta, typeRole.label, {
        color: surface.ink.hex,
        alpha: ink.label,
        wrapWidth: textWidth,
        maxLines: 2,
      });
  } else if (a.empty) {
    b.text(textX, rect.y + rect.height / 2, a.empty, typeRole.label, {
      color: surface.ink.hex,
      alpha: frame === "locked" ? ink.illegal : ink.meta,
      origin: [0, 0.5],
      wrapWidth: textWidth,
    });
  }
  if (frame !== "locked") b.tap(`seat:${a.index}`, rect);
  if (filled && a.clearLabel !== null) {
    b.button({
      key: `seat-clear:${a.deckId ?? a.index}`,
      rect: {
        x: rect.x + rect.width - SEAT_CLEAR_SIZE - 3,
        y: rect.y + 3,
        width: SEAT_CLEAR_SIZE,
        height: SEAT_CLEAR_SIZE,
      },
      label: "✕",
      look: "quiet",
      type: typeRole.label,
      aria: a.clearLabel,
    });
  }
}

export interface SeatChipArgs {
  readonly rect: Rect;
  readonly index: number;
  readonly frame: SeatFrame;
  readonly label: string;
  readonly name: string | null;
  /** "Justice · 14 HP", on a chip wide enough for it. */
  readonly meta: string | null;
  /** "Empty" or "Picking". */
  readonly empty: string | null;
}

/**
 * One compact seat chip (the narrow layouts' seat card, P03's "SEAT 1 / C. MARVEL"): the red label, a Bangers name (or
 * Empty), the same frames. There is no ✕ at ~80px wide; clearing lives in the seat summary line below.
 */
export function drawSeatChip(b: SheetBuilder, a: SeatChipArgs): void {
  const { rect, frame } = a;
  const dim = frame === "locked" ? ink.illegal : 1;
  const filled = frame === "filled" || frame === "activeFilled";
  seatFace(b, rect, frame, false);
  const pad = 7;
  const textWidth = rect.width - pad * 2;
  b.text(rect.x + pad, rect.y + pad, a.label, typeRole.label, {
    color: accent.heroRed.hex,
    alpha: dim,
    fitWidth: textWidth,
  });
  if (filled) {
    b.text(rect.x + pad, rect.y + 24, a.name ?? "?", typeRole.sectionHeader, {
      size: 17,
      color: surface.ink.hex,
      fitWidth: textWidth,
    });
    if (a.meta)
      b.text(rect.x + pad, rect.y + rect.height - pad - 11, a.meta, typeRole.label, {
        color: surface.ink.hex,
        alpha: ink.label,
        fitWidth: textWidth,
      });
  } else if (a.empty) {
    const picking = frame === "activeEmpty";
    b.text(rect.x + pad, rect.y + 24, a.empty, typeRole.label, {
      color: picking ? accent.heroRed.hex : surface.ink.hex,
      alpha: picking ? 1 : frame === "locked" ? ink.illegal : ink.meta,
      fitWidth: textWidth,
    });
  }
  if (frame !== "locked") b.tap(`seat:${a.index}`, rect);
}

export interface SeatSummaryArgs {
  readonly rect: Rect;
  readonly clearRect: Rect;
  /** The hint of an empty active seat ("Tap a hero below for seat 2."), or null with a hero seated. */
  readonly hint: string | null;
  /** Four short lines (stats, hand, obligation, nemesis); each fades as `strong` says. */
  readonly lines: readonly { readonly text: string; readonly strong: boolean }[];
  readonly clearLabel: string;
  /** Why Clear does nothing (the last hero stays), or null when it works. */
  readonly clearBlocked: string | null;
}

/**
 * Narrow only: the active seat's facts on one strip under the seat chips, plus the "Clear seat" control the chips have no
 * room for. An empty active seat gets the hint instead.
 */
export function drawSeatSummary(b: SheetBuilder, a: SeatSummaryArgs): void {
  const { rect } = a;
  if (a.hint !== null) {
    b.text(rect.x, rect.y + rect.height / 2, a.hint, typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.meta,
      origin: [0, 0.5],
      wrapWidth: rect.width,
    });
    return;
  }
  const textWidth = rect.width - a.clearRect.width - 12;
  // Short label lines rather than the wide panel's one long stat line: at a phone's ~240px of text width a single line
  // ellipsized its own DEF.
  const lineStep = 12;
  let y = rect.y + (rect.height - lineStep * a.lines.length) / 2;
  for (const line of a.lines) {
    b.text(rect.x, y, line.text, typeRole.label, {
      color: surface.ink.hex,
      alpha: line.strong ? 1 : ink.label,
      fitWidth: textWidth,
    });
    y += lineStep;
  }
  b.button({
    key: "clear-seat",
    rect: a.clearRect,
    label: a.clearLabel,
    look: "quiet",
    type: typeRole.label,
    ...(a.clearBlocked !== null ? { disabled: a.clearBlocked, pressable: true } : {}),
  });
}

export interface DetailPanelArgs {
  readonly rect: Rect;
  /** The hero's facts, or null before a hero is chosen. */
  readonly hero: {
    readonly name: string;
    /** "Deck name · tested by ...", or null. */
    readonly credit: string | null;
    readonly stats: string;
    readonly obligationLabel: string;
    readonly obligation: string;
    readonly nemesisLabel: string;
    readonly nemesis: string;
  } | null;
  /** "Seat 1 is set · pick seat 2 below": above the name while the next seat is being chosen. */
  readonly seatNote: string | null;
  /** What the panel says before a hero is chosen. */
  readonly emptyText: string;
  readonly textWidth: number;
}

/** The wide layout's ink hero-detail panel. Returns where its text ended, for the insights block under it. */
export function drawDetailPanel(b: SheetBuilder, a: DetailPanelArgs): number {
  const { rect } = a;
  b.box(rect, { fill: surface.ink.hex });
  const x = rect.x + 16;
  const width = rect.width - 32;
  const hero = a.hero;
  if (!hero) {
    b.text(x, rect.y + 16, a.emptyText, typeRole.body, {
      color: surface.paper.hex,
      alpha: ink.label,
      wrapWidth: width,
    });
    return rect.y + 60;
  }
  let y = rect.y + 16;
  if (a.seatNote) {
    const note = b.text(x, y, a.seatNote, typeRole.label, {
      size: 9,
      color: surface.paper.hex,
      alpha: ink.label,
      fitWidth: width,
    });
    y += note.height + 10;
  }
  const name = b.text(x, y, hero.name, typeRole.sectionHeader, {
    size: 22,
    color: surface.paper.hex,
    wrapWidth: width,
  });
  y += name.height + 6;
  if (hero.credit) {
    const credit = b.text(x, y, hero.credit, typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      wrapWidth: width,
    });
    y += credit.height + 6;
  }
  const stats = b.text(x, y, hero.stats, typeRole.label, {
    color: surface.paper.hex,
    alpha: ink.label,
    wrapWidth: width,
  });
  y += stats.height + 12;
  b.box({ x, y, width, height: 1 }, { fill: surface.paper.hex, fillAlpha: ink.disabled });
  y += 14;
  b.text(x, y, hero.obligationLabel, typeRole.label, { color: surface.paper.hex, alpha: ink.label });
  y += 16;
  const obligation = b.text(x, y, hero.obligation, typeRole.body, { color: surface.paper.hex, wrapWidth: a.textWidth });
  y += obligation.height + 12;
  b.text(x, y, hero.nemesisLabel, typeRole.label, { color: surface.paper.hex, alpha: ink.label });
  y += 16;
  const nemesis = b.text(x, y, hero.nemesis, typeRole.body, { color: surface.paper.hex, wrapWidth: a.textWidth });
  return y + nemesis.height;
}

/** The pill on a Team-Up bracket: where it sits and what it shows. */
export interface PairPillArgs {
  readonly strip: Rect;
  readonly seatRects: readonly Rect[];
  readonly pairs: readonly {
    readonly seats: readonly [number, number];
    readonly label: string;
    /** The pair's names, for the badge picture. */
    readonly names: readonly [string, string];
  }[];
  readonly rowHeight: number;
}

/**
 * The Team-Up marker under the seat cards: a bracket from each partner's card down to a line with a pill on it, the pair's
 * picture where there is art and "Team-Up: Colossus and Shadowcat". Not interactive: it only says what the table has.
 */
export function drawPairStrip(b: SheetBuilder, a: PairPillArgs): readonly PairBracket[] {
  const brackets = pairBracketsOf(a.strip, a.pairs, a.seatRects, a.rowHeight);
  const seatBottom = a.seatRects[0]!.y + a.seatRects[0]!.height;
  brackets.forEach((bracket, row) => {
    const pair = a.pairs[row]!;
    const [left, right] = bracket.xs;
    b.poly(
      [
        [left, seatBottom],
        [left, bracket.y],
        [right, bracket.y],
        [right, seatBottom],
      ],
      { stroke: accent.heroRed.hex, strokeWidth: 2 },
    );
    const art = teamUpArtFor(TEAM_UP_ART, pair.names)?.badge ?? null;
    const ring = a.rowHeight - 2;
    const text = b.measure(pair.label, typeRole.label, {});
    const pill = pairPillRect(a.strip, bracket, text.width, ring, art !== null);
    b.box(pill, { fill: surface.ink.hex });
    b.box(pill, { stroke: accent.heroRed.hex, strokeWidth: 2 });
    let textX = pill.x + 8;
    if (art) {
      const badge: Rect = { x: pill.x + 1, y: pill.y + 1, width: ring - 2, height: ring - 2 };
      b.image(badge, { src: art.url, cover: { x: 0.5, y: 0.5 }, fill: surface.ink.hex, key: `pair-badge:${row}` });
      b.box(badge, { stroke: accent.heroRed.hex, strokeWidth: border.detail / 2 });
      textX = pill.x + ring + 6;
    }
    b.text(textX, bracket.y, pair.label, typeRole.label, {
      color: surface.paper.hex,
      origin: [0, 0.5],
      fitWidth: pill.x + pill.width - textX - 6,
    });
  });
  return brackets;
}
