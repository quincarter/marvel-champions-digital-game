/**
 * The Seating section: one seat cell per seated deck (the hero's picture, name and "First player" / "Seat N") and a
 * Random control; on the phone a row of compact chips. Each seat leaves a keyed, transparent "spot" where the first player
 * token rests; the token is its own panel over the sheet (`token-layer.ts`), placed from the live rect of the first
 * player's spot. It draws what `SeatingInput` says and raises `SeatingEvents`.
 */
import type { Rect } from "../../../view/layout.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import { currentCardsById } from "../../../content/pool.js";
import { heroPictureOf } from "../../../dom/hero-picture.js";
import { COMPACT_FIRST_PLAYER_ROW_HEIGHT as CHIP_H } from "../../../view/table-setup-layout.js";
import { t, tPlural } from "../../../i18n/translate.js";
import { button, heading, inset, nameText, press, type Frame } from "../shared/frame.js";
import type { SeatCell, SeatingEvents, SeatingInput } from "./seating.types.js";

/** The spot key of seat `index`: where its first player token rests. */
export const spotKey = (index: number): string => `seat-spot:${index}`;

/** A seat's hero, so the table reads as people rather than text boxes; its picture opens the identity card's hover. */
function avatar(f: Frame, rect: Rect, cell: SeatCell, scroll: string | null): void {
  const identity = cell.identityCardId ? currentCardsById().get(cell.identityCardId) : undefined;
  const pic = heroPictureOf(identity, f.leases);
  const key = `avatar:${cell.index}`;
  f.b.image(rect, {
    src: pic.src,
    fill: surface.ink.hex,
    cover: pic.cover,
    key,
    ...(cell.identityCardId ? { hover: cell.identityCardId } : {}),
    ...(pic.retry !== undefined ? { retry: pic.retry } : {}),
  });
  if (cell.identityCardId) f.reg.faces.push({ key, cardId: cell.identityCardId, scroll });
}

/** A dashed "Random" control (a roll of the seed's own first player). */
function randomCell(f: Frame, on: SeatingEvents, rect: Rect, ground: number, scroll?: string): void {
  const line = ground === surface.ink.hex ? surface.paper.hex : surface.ink.hex;
  f.b.box(rect, { fill: ground });
  f.b.box(inset(rect, 1), { stroke: line, strokeWidth: 1.5, dashed: true });
  f.b.text(rect.x + rect.width / 2, rect.y + rect.height / 2, t("tableSetup.random"), typeRole.label, {
    color: line,
    alpha: ink.label,
    origin: [0.5, 0.5],
    fitWidth: rect.width - 10,
  });
  press(f, "first-player:random", rect, on.roll, { scroll });
}

/** The seating row; `random` adds a dashed cell at its end (tablet portrait; wide keeps the control on the header line). */
function seatingRow(f: Frame, on: SeatingEvents, cells: readonly SeatCell[], rect: Rect, random: boolean): void {
  const gap = 10;
  const count = cells.length + (random ? 1 : 0);
  const width = (rect.width - gap * (count - 1)) / count;
  cells.forEach((cell, index) => {
    const r: Rect = { x: rect.x + index * (width + gap), y: rect.y, width, height: rect.height };
    f.b.box(r, { fill: surface.card.hex });
    f.b.box(inset(r, 0.75), { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: cell.selected ? 1 : ink.label });
    // The token's spot: an empty ring on everyone else; the first player's token comes down on it.
    const dot = Math.min(30, r.height * 0.5);
    const spot: Rect = { x: r.x + 10, y: r.y + r.height / 2 - dot / 2, width: dot, height: dot };
    if (!cell.selected)
      f.b.box(inset(spot, 2), { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: ink.label, round: true });
    f.b.box(inset(spot, -dot * 0.175), { key: spotKey(index) });
    const pic: Rect = { x: spot.x + dot + 8, y: r.y + 6, width: r.height - 12, height: r.height - 12 };
    avatar(f, pic, cell, null);
    const textX = pic.x + pic.width + 10;
    const room = r.x + r.width - textX - 6;
    nameText(f.b, textX, r.y + r.height * 0.34, room, cell.name, 14);
    f.b.text(textX, r.y + r.height * 0.68, cell.meta, typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.label,
      fitWidth: room,
    });
    press(f, `first-player:${index}`, r, () => on.pick(index));
  });
  if (random)
    randomCell(
      f,
      on,
      { x: rect.x + cells.length * (width + gap), y: rect.y, width, height: rect.height },
      surface.ink.hex,
    );
}

/** The phone's first-player chips: "YOU" / "S2" over the hero's name, ink fill = first player, plus a dashed Random chip. */
function chipRow(f: Frame, on: SeatingEvents, cells: readonly SeatCell[], rect: Rect): void {
  const gap = 6;
  const width = (rect.width - gap * cells.length) / (cells.length + 1);
  cells.forEach((cell, index) => {
    const r: Rect = { x: rect.x + index * (width + gap), y: rect.y, width, height: CHIP_H };
    f.b.box(r, { fill: cell.selected ? surface.ink.hex : surface.card.hex });
    f.b.box(inset(r, 1.25), { stroke: surface.ink.hex, strokeWidth: 2.5 });
    const tone = cell.selected ? surface.paper.hex : surface.ink.hex;
    // A chip wide enough (one or two seats) shows the seat's hero on its left and centres its text in the rest.
    const side = CHIP_H - 12;
    const withPicture = width >= side + 80;
    if (withPicture) avatar(f, { x: r.x + 6, y: r.y + 6, width: side, height: side }, cell, "page");
    const left = withPicture ? r.x + side + 12 : r.x;
    const span = r.x + r.width - left;
    f.b.text(
      left + span / 2,
      r.y + CHIP_H * 0.36,
      cell.chipLabel,
      { ...typeRole.sectionHeader, size: 15 },
      {
        color: tone,
        origin: [0.5, 0.5],
        size: 15,
        fitWidth: span - 8,
      },
    );
    f.b.text(left + span / 2, r.y + CHIP_H * 0.72, cell.name, typeRole.label, {
      color: tone,
      alpha: ink.label,
      origin: [0.5, 0.5],
      fitWidth: span - 8,
    });
    // The token sits on the chip's top right corner.
    f.b.box({ x: r.x + width - 34 * 0.3 - 17, y: r.y + 34 * 0.3 - 17, width: 34, height: 34 }, { key: spotKey(index) });
    press(f, `first-player:${index}`, r, () => on.pick(index), { scroll: "page" });
  });
  randomCell(
    f,
    on,
    { x: rect.x + cells.length * (width + gap), y: rect.y, width, height: CHIP_H },
    surface.paper.hex,
    "page",
  );
}

/** Room mode: in place of the seating row, a note that the players bring their own hero and deck (#880). */
function roomNote(f: Frame, rect: Rect, count: number, color: number): void {
  f.b.text(rect.x, rect.y + 4, tPlural("room.setup.seatsNote", count), typeRole.body, {
    color,
    size: 13,
    wrapWidth: rect.width,
  });
}

/** Where the wide and tablet-portrait layouts put the section's parts. */
export interface SeatingLayout {
  readonly wide: boolean;
  readonly header: Rect;
  readonly random: Rect;
  readonly row: Rect;
}

/** The whole section on a wide screen or a tablet in portrait. */
export function drawSeating(
  f: Frame,
  input: SeatingInput,
  on: SeatingEvents,
  layout: SeatingLayout,
  body: number,
): void {
  heading(f.b, layout.header.x, layout.header.y, layout.header.width, t("tableSetup.seating"), body);
  if (input.room) return roomNote(f, layout.row, input.seats.length, body);
  const ownRandom = layout.wide && layout.random.width > 0;
  if (ownRandom) button(f, "first-player:random", layout.random, t("tableSetup.random"), on.roll);
  seatingRow(f, on, input.seats, layout.row, !ownRandom);
}

/** The phone's rows: the "First player" heading and the chip row; true when the id was one of the section's own. */
export function drawCompactSeating(f: Frame, input: SeatingInput, on: SeatingEvents, id: string, rect: Rect): boolean {
  if (id === "header:firstPlayer") {
    heading(f.b, rect.x, rect.y + 2, rect.width, t("tableSetup.firstPlayerHead"), surface.ink.hex);
    return true;
  }
  if (id !== "firstPlayer") return false;
  if (input.room) roomNote(f, rect, input.seats.length, surface.ink.hex);
  else chipRow(f, on, input.seats, rect);
  return true;
}
