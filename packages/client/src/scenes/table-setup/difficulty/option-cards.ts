/**
 * The setup-option cards (Gene Pool threat, the Horsemen's sides, easier start...), the Standard / Expert set choices and
 * Tower Defense's toggle: framed cards whose controls are chips, steppers or the whole card. Every control is an action
 * string the view model applies (`applySetupOption`), so this lays out and never decides.
 */
import type { Rect } from "../../../view/layout.js";
import { hit, ink, surface, typeRole } from "../../../tokens.js";
import { difficultySetLine } from "../../../view/difficulty-sets.js";
import {
  COMPACT_GROUP_CELL_HEIGHT,
  OPTION_GROUPS_NAME_ZONE,
  SETS_INLINE_NAME_WIDTH,
  optionGroupsStacked,
  setChoiceRowRects,
} from "../../../view/table-setup-layout.js";
import type { DifficultyEvents } from "./difficulty.types.js";
import type { OptionChip, SetupOptionRow } from "../../../view/setup-options.js";
import { lt } from "../text/lt.js";
import { t } from "../../../i18n/translate.js";
import { cardFrame, labelText, nameText, press, segment, type Frame } from "../shared/frame.js";

/** A Horseman's name beside its A/B pair: wide enough for "Pestilence" at the label size. */
const HORSEMAN_LABEL_WIDTH = 72;

/** A chip: a segment under a press area; one that cannot be pressed (a stepper at its end) is drawn, not a stop. */
function chip(c: Frame, on: DifficultyEvents, chipDef: OptionChip, rect: Rect, scroll?: string): void {
  const size = Math.max(14, Math.min(22, rect.height - 8));
  segment(c.b, rect, chipDef.label, chipDef.selected, size, chipDef.enabled);
  if (chipDef.enabled) press(c, `option:${chipDef.action}`, rect, () => on.option(chipDef.action), { scroll });
}

/** A row of `chips` right-aligned (or left-aligned when stacked) in `zone`, each at most `max` wide. */
function chipRow(
  c: Frame,
  on: DifficultyEvents,
  chips: readonly OptionChip[],
  zone: Rect,
  max: number,
  left: boolean,
  scroll?: string,
): void {
  const gap = 6;
  const width = Math.min(max, (zone.width - gap * (chips.length - 1)) / chips.length);
  const total = width * chips.length + gap * (chips.length - 1);
  const start = left ? zone.x : zone.x + zone.width - total;
  chips.forEach((def, i) =>
    chip(c, on, def, { x: start + i * (width + gap), y: zone.y, width, height: zone.height }, scroll),
  );
}

/** One setup-option card: the name at the left and its controls at the right, or the name over them on a phone. */
export function optionCard(
  c: Frame,
  on: DifficultyEvents,
  rect: Rect,
  row: SetupOptionRow,
  compact: boolean,
  scroll?: string,
): void {
  const { b } = c;
  const dim = row.active ? 1 : ink.secondary;
  const control = row.control;
  if (control.kind === "toggle") {
    cardFrame(b, rect, row.active);
    nameText(b, rect.x + 10, rect.y + 8, rect.width - 20, row.name, 18, dim);
    b.text(rect.x + 10, rect.y + 30, row.meta, typeRole.body, { color: surface.ink.hex, alpha: ink.secondary });
    press(c, `option:${control.action}`, rect, () => on.option(control.action), { scroll });
    return;
  }
  cardFrame(b, rect, row.active);
  // Side by side when there is room, stacked on a phone; a stepper whose value is a name stacks too, so the name keeps the row.
  const stacked = compact && (control.kind === "groups" || (control.kind === "stepper" && control.wide === true));
  const nameWidth = stacked
    ? rect.width - 20
    : control.kind === "groups" && control.groups.length > 1
      ? OPTION_GROUPS_NAME_ZONE
      : Math.min(170, rect.width * 0.4);
  const name = nameText(b, rect.x + 10, rect.y + (stacked ? 6 : 8), nameWidth - (stacked ? 0 : 6), row.name, 18, dim);
  if (row.meta.length > 0 && !stacked)
    b.text(rect.x + 10, rect.y + 10 + Math.max(22, name.height), row.meta, typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: nameWidth - 6,
    });
  const zone: Rect = stacked
    ? { x: rect.x + 8, y: rect.y + 30, width: rect.width - 16, height: rect.height - 38 }
    : { x: rect.x + nameWidth + 10, y: rect.y + 8, width: rect.width - nameWidth - 18, height: rect.height - 16 };

  if (control.kind === "stepper") {
    const w = Math.min(48, zone.width / 3);
    const down: Rect = {
      x: control.wide ? zone.x : zone.x + zone.width - w * 2 - 56,
      y: zone.y,
      width: w,
      height: zone.height,
    };
    const up: Rect = { x: zone.x + zone.width - w, y: zone.y, width: w, height: zone.height };
    chip(c, on, control.down, down, scroll);
    chip(c, on, control.up, up, scroll);
    b.text(
      (down.x + down.width + up.x) / 2,
      zone.y + zone.height / 2,
      control.valueLabel,
      { ...typeRole.sectionHeader, size: 20 },
      {
        color: surface.ink.hex,
        alpha: row.active ? 1 : ink.secondary,
        origin: [0.5, 0.5],
        size: 20,
        ...(control.wide ? { fitWidth: up.x - down.x - down.width - 8 } : {}),
      },
    );
    return;
  }

  const groups = control.groups;
  if (groups.length === 1) {
    chipRow(c, on, groups[0]!.chips, zone, stacked ? 120 : 84, stacked, scroll);
    return;
  }
  // Several groups (the Horsemen): each A/B pair as two full chips, its label beside the pair or over it.
  const over = stacked || optionGroupsStacked(rect.width, groups.length);
  const perRow = stacked ? 2 : groups.length;
  const gap = 12;
  const cellWidth = (zone.width - gap * (perRow - 1)) / perRow;
  const cellHeight = stacked ? COMPACT_GROUP_CELL_HEIGHT : zone.height;
  groups.forEach((group, index) => {
    const cx = zone.x + (index % perRow) * (cellWidth + gap);
    const cy = zone.y + Math.floor(index / perRow) * cellHeight;
    const pair = over ? cellWidth : hit.target * 2 + 4;
    const width = (pair - 4 * (group.chips.length - 1)) / group.chips.length;
    if (over) labelText(b, cx, cy, group.label ?? "", surface.ink.hex, { fitWidth: cellWidth });
    else
      b.text(
        cx + HORSEMAN_LABEL_WIDTH,
        cy + (hit.target - typeRole.label.size) / 2 - 2,
        group.label ?? "",
        typeRole.label,
        {
          color: surface.ink.hex,
          alpha: ink.label,
          origin: [1, 0],
          fitWidth: HORSEMAN_LABEL_WIDTH,
        },
      );
    group.chips.forEach((def, i) =>
      chip(
        c,
        on,
        def,
        {
          x: (over ? cx : cx + HORSEMAN_LABEL_WIDTH + 4) + i * (width + 4),
          y: over ? cy + 16 : cy,
          width,
          height: hit.target,
        },
        scroll,
      ),
    );
  });
}

/** "Cards ▸" on a Standard/Expert set row: one sheet with every set the rows offer, each under where it comes from. */
function setsCardsButton(c: Frame, on: DifficultyEvents, rect: Rect, scroll?: string): void {
  c.b.text(rect.x + rect.width / 2, rect.y + rect.height / 2, t("tableSetup.cards"), typeRole.label, {
    color: surface.ink.hex,
    origin: [0.5, 0.5],
    fitWidth: rect.width,
  });
  press(c, "sets-cards", rect, on.setsSheet, { scroll });
}

/** The Standard and Expert set choices folded into the difficulty row's spare slot (or a strip under the cards). */
export function setsCard(
  c: Frame,
  on: DifficultyEvents,
  card: Rect,
  rows: readonly SetupOptionRow[],
  inline: boolean,
): void {
  cardFrame(
    c.b,
    card,
    rows.some((row) => row.active),
  );
  const rects = setChoiceRowRects(card, rows.length, inline);
  rects.forEach((r, index) => {
    const row = rows[index];
    if (!row || row.control.kind !== "groups") return;
    const size = inline ? 16 : 14;
    const cardsRect: Rect = inline
      ? { x: r.name.x + 2, y: r.name.y + 22, width: 74, height: 20 }
      : { x: r.name.x + r.name.width - 70, y: r.name.y - 2, width: 70, height: 16 };
    if (index === 0) setsCardsButton(c, on, cardsRect);
    nameText(
      c.b,
      r.name.x + 2,
      r.name.y + (inline ? 0 : -2),
      r.name.width - 4 - (inline ? 0 : cardsRect.width + 6),
      row.name,
      size,
      row.active ? 1 : ink.secondary,
    );
    chipRow(c, on, row.control.groups[0]!.chips, r.chips, 80, false);
  });
  const last = rects[rects.length - 1];
  if (last && rows.length === 1) {
    const top = last.chips.y + last.chips.height + 3;
    if (card.y + card.height - top >= 14)
      labelText(c.b, card.x + 10, top, lt(difficultySetLine(rows[0]!)), surface.ink.hex, { fitWidth: card.width - 20 });
  }
}

/** A Standard / Expert set row on the phone: a framed card, the name at the left and a full 44px chip row at the right. */
export function compactSetRow(c: Frame, on: DifficultyEvents, card: Rect, row: SetupOptionRow, scroll: string): void {
  if (row.control.kind !== "groups") return;
  cardFrame(c.b, card, row.active);
  setsCardsButton(c, on, { x: card.x + 10, y: card.y + card.height - 24, width: 74, height: 18 }, scroll);
  nameText(c.b, card.x + 10, card.y + 4, SETS_INLINE_NAME_WIDTH - 20, row.name, 16, row.active ? 1 : ink.secondary);
  const zone: Rect = {
    x: card.x + SETS_INLINE_NAME_WIDTH,
    y: card.y + (card.height - hit.target) / 2,
    width: card.width - SETS_INLINE_NAME_WIDTH - 8,
    height: hit.target,
  };
  chipRow(c, on, row.control.groups[0]!.chips, zone, 80, false, scroll);
}
