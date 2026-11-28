/**
 * The wide layout's tiles: a required set (ink, locked), a candidate set (picture, name, count, "Cards" tab), a Civil War
 * summary line and one of The Hood's set-aside candidates. A tile's picture and its tab open the set's cards; the rest of
 * the tile toggles the set.
 */
import type { Rect } from "../../../view/layout.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import { artFor } from "../../../art/art-source.js";
import { currentCardsById } from "../../../content/pool.js";
import { cardsBySet, setFacesOf, type FaceRef } from "../../../view/civil-war-builder-art.js";
import {
  modularCardLabel,
  requiredCardLabel,
  type ModularSetOption,
  type RequiredEncounterSet,
} from "../../../view/modular-sets.js";
import type { HoodModularSetOption } from "../../../view/hood-modular-sets.js";
import { EDIT_SCENARIO_ID, type CivilWarTableSummary } from "../../../view/civil-war-table-summary.js";
import { t, tPlural } from "../../../i18n/translate.js";
import { lt } from "../text/lt.js";
import { cardFrame, inset, labelText, nameText, press, type Frame } from "../shared/frame.js";
import type { ModularsEvents } from "./modulars.types.js";

/** The modular tiles' pictures: the set's most recognizable card, framed from the top. */
export const PICTURE_FOCUS = { x: 0.5, y: 0.12 } as const;
/** The "Cards" tab in a wide tile's bottom-right corner. */
const TAB_WIDTH = 80;

const facesBySet = new WeakMap<object, Map<string, FaceRef | null>>();

/** A set's most recognizable card, or null for a set with no cards on hand (cached per card pool). */
function faceOf(setId: string): FaceRef | null {
  const cards = currentCardsById();
  let cache = facesBySet.get(cards);
  if (!cache) facesBySet.set(cards, (cache = new Map()));
  if (!cache.has(setId)) cache.set(setId, setFacesOf(cardsBySet(cards).get(setId) ?? [], 1)[0] ?? null);
  return cache.get(setId) ?? null;
}

/** The label line under a name, clamped to the lines that fit below `top` inside `rect`. */
export function cardLabel(
  f: Frame,
  rect: Rect,
  left: number,
  width: number,
  top: number,
  text: string,
  color: number,
  alpha: number,
): void {
  const lines = Math.max(1, Math.floor((rect.y + rect.height - 4 - top) / 12));
  labelText(f.b, left, top, text, color, { alpha, wrapWidth: width, maxLines: lines });
}

/** The set's picture in its frame; registers it for the hover popover and hold-Y zoom. */
export function setPicture(
  f: Frame,
  picture: Rect,
  option: ModularSetOption,
  scroll: string | null,
  dim: boolean,
): void {
  const face = faceOf(option.id);
  const key = `pic:${option.id}`;
  const held = face ? f.leases.image(artFor(currentCardsById().get(face.cardId as string), face.face)) : null;
  f.b.image(picture, {
    src: held?.src ?? null,
    fill: surface.parchment.hex,
    cover: PICTURE_FOCUS,
    key,
    ...(face ? { hover: face.cardId as string } : {}),
    ...(held?.retry !== undefined ? { retry: held.retry } : {}),
  });
  f.b.box(inset(picture, 0.75), {
    stroke: surface.ink.hex,
    strokeWidth: 1.5,
    alpha: dim ? ink.label * 0.6 : ink.label,
  });
  if (face) {
    f.reg.faces.push({ key, cardId: face.cardId as string, face: face.face, scroll });
    f.reg.zoom.set(`modular:${option.id}`, key);
  }
}

/** Presses on a picture and its tab open the set's cards: taps made right after the tile's own, so they sit above it. */
export function cardsTaps(
  f: Frame,
  on: ModularsEvents,
  option: ModularSetOption,
  areas: readonly Rect[],
  scroll?: string,
): void {
  areas.forEach((area, i) =>
    press(f, `modular:${option.id}:cards${i}`, area, () => on.cards(option.id), { scroll, noStop: true }),
  );
}

/** The scenario's own required set: ink-filled, paper text, never toggleable (no press, no stop). */
export function requiredTile(f: Frame, rect: Rect, required: RequiredEncounterSet, villainName: string): void {
  f.b.box(rect, { fill: surface.ink.hex });
  const name = nameText(f.b, rect.x + 10, rect.y + 8, rect.width - 20, required.name, 15, 1, surface.paper.hex);
  cardLabel(
    f,
    rect,
    rect.x + 10,
    rect.width - 20,
    rect.y + 8 + name.height + 4,
    lt(requiredCardLabel(villainName, required.cardCount)).toUpperCase(),
    surface.paper.hex,
    ink.label,
  );
}

/** A candidate set: chosen = red border; a set this scenario may not use is dimmed, with its reason where the count goes. */
export function modularTile(f: Frame, on: ModularsEvents, rect: Rect, option: ModularSetOption, scroll?: string): void {
  const barred = option.disabledReason !== null;
  const dim = !barred || option.selected ? 1 : ink.disabled;
  cardFrame(f.b, rect, option.selected);
  const hasPicture = option.kind !== "random";
  const height = rect.height - 10;
  const picture: Rect = { x: rect.x + 6, y: rect.y + 5, width: Math.round((height * 5) / 7), height };
  if (hasPicture) setPicture(f, picture, option, scroll ?? null, dim !== 1);
  const tab: Rect = {
    x: rect.x + rect.width - TAB_WIDTH,
    y: rect.y + rect.height - 22,
    width: TAB_WIDTH - 4,
    height: 18,
  };
  const textX = hasPicture ? picture.x + picture.width + 8 : rect.x + 10;
  const name = nameText(f.b, textX, rect.y + 8, rect.x + rect.width - 10 - textX, option.name, 15, dim);
  // The label gets the tile's whole width when it fits on one line (the tab sits lower), else the room beside the tab.
  const label = lt(modularCardLabel(option)).toUpperCase();
  const full = rect.x + rect.width - 10 - textX;
  const beside = (hasPicture ? rect.x + rect.width - TAB_WIDTH : rect.x + rect.width - 10) - textX;
  const oneLine = hasPicture && f.b.measure(label, typeRole.label).width <= full;
  cardLabel(
    f,
    rect,
    textX,
    oneLine ? full : beside,
    rect.y + 8 + name.height + 4,
    label,
    surface.ink.hex,
    dim === 1 ? ink.label : ink.disabled,
  );
  if (hasPicture)
    labelText(f.b, tab.x + tab.width / 2, tab.y + tab.height / 2, t("tableSetup.cardsTab"), surface.ink.hex, {
      alpha: 1,
      origin: [0.5, 0.5],
      fitWidth: tab.width,
    });
  press(f, `modular:${option.id}`, rect, () => !barred && on.toggle(option.id), {
    scroll,
    ...(hasPicture ? { inspect: () => on.cards(option.id) } : {}),
  });
  if (hasPicture) {
    const left: Rect = { x: rect.x, y: rect.y, width: picture.x + picture.width + 4 - rect.x, height: rect.height };
    cardsTaps(f, on, option, [left, tab], scroll);
  }
}

/** A Civil War build's summary line (name and value), or its "Edit scenario" tile. */
export function summaryTile(f: Frame, on: ModularsEvents, cell: Rect, cw: CivilWarTableSummary, index: number): void {
  const row = cw.rows[index];
  cardFrame(f.b, cell, !row);
  const name = nameText(f.b, cell.x + 10, cell.y + 8, cell.width - 20, row ? row.label : cw.editLabel, 15);
  if (row)
    cardLabel(
      f,
      cell,
      cell.x + 10,
      cell.width - 20,
      cell.y + 8 + name.height + 4,
      row.value,
      surface.ink.hex,
      ink.label,
    );
  else press(f, `modular:${EDIT_SCENARIO_ID}`, cell, on.editScenario);
}

/** What a Hood candidate says under its name: in the game (with its card count) or set aside. */
export function hoodMeta(option: HoodModularSetOption): string {
  return option.included
    ? t("tableSetup.hoodIn", {
        label: lt(modularCardLabel({ selected: true, cardCount: option.cardCount, descriptor: option.descriptor })),
      })
    : t("tableSetup.hoodAside", { cards: tPlural("tableSetup.cardsN", option.cardCount) });
}

/** One of The Hood's own candidates: included = red border, set aside = a thin one. */
export function hoodTile(f: Frame, on: ModularsEvents, rect: Rect, option: HoodModularSetOption): void {
  cardFrame(f.b, rect, option.included);
  const name = nameText(f.b, rect.x + 10, rect.y + 8, rect.width - 20, option.name, 15);
  cardLabel(
    f,
    rect,
    rect.x + 10,
    rect.width - 20,
    rect.y + 8 + name.height + 4,
    hoodMeta(option).toUpperCase(),
    surface.ink.hex,
    ink.label,
  );
  press(f, `hoodSet:${option.id}`, rect, () => on.toggleHood(option.id));
}
