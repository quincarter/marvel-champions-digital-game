/**
 * The phone's rows for the Modular sets section: a required set (locked), a candidate with its picture, a group's Show /
 * Hide row, a Civil War summary line and a Hood candidate.
 */
import type { Rect } from "../../../view/layout.js";
import { accent, surface, typeRole } from "../../../tokens.js";
import { COMPACT_GROUP_ROW_HEIGHT, COMPACT_MODULAR_ROW_HEIGHT as ROW_H } from "../../../view/table-setup-layout.js";
import {
  modularCardLabel,
  type ModularGroupSummary,
  type ModularSetOption,
  type RequiredEncounterSet,
} from "../../../view/modular-sets.js";
import type { HoodModularSetOption } from "../../../view/hood-modular-sets.js";
import { EDIT_SCENARIO_ID, type CivilWarTableSummary } from "../../../view/civil-war-table-summary.js";
import { t, tPlural } from "../../../i18n/translate.js";
import { checkbox, inset, labelText, nameText, press, type Frame } from "../shared/frame.js";
import { lt } from "../text/lt.js";
import { toggleRow } from "../shared/toggle-row.js";
import { cardsTaps, hoodMeta, setPicture } from "./tiles.js";
import type { ModularsEvents } from "./modulars.types.js";

/** The scenario's own required set: ink-filled, a red checked box and "locked", never toggleable. */
export function requiredRow(f: Frame, rect: Rect, required: RequiredEncounterSet, villainName: string): void {
  const r: Rect = { ...rect, height: ROW_H };
  f.b.box(r, { fill: surface.ink.hex });
  f.b.box(inset(r, 1.5), { stroke: surface.ink.hex, strokeWidth: 3 });
  const box = checkbox(f.b, rect, ROW_H, true, accent.heroRed.hex);
  const x = box.x + box.width + 11;
  const width = rect.x + rect.width - x - 10;
  nameText(f.b, x, rect.y + 11, width, required.name, 13, 1, surface.paper.hex);
  labelText(f.b, x, rect.y + 29, t("tableSetup.requiredBy", { villain: villainName }), surface.paper.hex, {
    fitWidth: width,
  });
}

/** A candidate set: a toggle row with the set's picture at the right end and "Cards" under it. */
export function modularRow(f: Frame, on: ModularsEvents, rect: Rect, option: ModularSetOption): void {
  const barred = option.disabledReason !== null;
  const hasPicture = option.kind !== "random";
  const height = ROW_H - 20;
  const width = Math.round((height * 5) / 7);
  const picture: Rect = { x: rect.x + rect.width - width - 22, y: rect.y + 4, width, height };
  const key = `modular:${option.id}`;
  toggleRow(
    f,
    rect,
    {
      key,
      selected: option.selected,
      name: option.name,
      meta: lt(modularCardLabel(option)),
      run: () => !barred && on.toggle(option.id),
    },
    hasPicture ? picture.x - 8 : rect.x + rect.width - 10,
  );
  if (!hasPicture) return;
  setPicture(f, picture, option, "page", false);
  labelText(
    f.b,
    picture.x + picture.width / 2,
    picture.y + picture.height + 7,
    t("tableSetup.cardsTab"),
    surface.ink.hex,
    {
      alpha: 1,
      origin: [0.5, 0.5],
      fitWidth: picture.width + 28,
    },
  );
  const area: Rect = { x: picture.x - 14, y: rect.y, width: rect.x + rect.width - (picture.x - 14), height: ROW_H };
  cardsTaps(f, on, option, [area], "page");
  // Inspect on the row's stop opens the cards, as the picture does.
  const stop = f.reg.stops.get(key);
  if (stop) f.reg.stops.set(key, { ...stop, inspect: () => on.cards(option.id) });
}

/** A modular group's row: name and count at the left, Show or Hide at the right; a tap folds or unfolds it. */
export function groupRow(f: Frame, on: ModularsEvents, rect: Rect, group: ModularGroupSummary, open: boolean): void {
  const r: Rect = { ...rect, height: COMPACT_GROUP_ROW_HEIGHT };
  f.b.box(inset(r, 1), { stroke: surface.ink.hex, strokeWidth: 2 });
  const action = labelText(
    f.b,
    rect.x + rect.width - 12,
    r.y + r.height / 2,
    t(open ? "tableSetup.hide" : "tableSetup.show"),
    surface.ink.hex,
    { alpha: 1, origin: [1, 0.5] },
  );
  const chosen = group.selectedCount > 0 ? t("tableSetup.chosen", { n: group.selectedCount }) : "";
  labelText(
    f.b,
    rect.x + 12,
    r.y + r.height / 2,
    `${group.label} · ${tPlural("tableSetup.sets", group.count)}${chosen}`,
    surface.ink.hex,
    { alpha: 1, origin: [0, 0.5], fitWidth: rect.width - 32 - action.width },
  );
  press(f, `modulargroup:${group.id}`, r, () => on.toggleGroup(group.id, !open), { scroll: "page" });
}

/** A Civil War build's summary line as a paper row (name over value), or the Edit row as a tappable one. */
export function summaryRow(f: Frame, on: ModularsEvents, rect: Rect, cw: CivilWarTableSummary, rowId: string): void {
  const row = cw.rows.find((r) => r.id === rowId);
  const r: Rect = { ...rect, height: ROW_H };
  f.b.box(r, { fill: surface.card.hex });
  f.b.box(inset(r, 1.25), { stroke: surface.ink.hex, strokeWidth: 2.5 });
  if (!row) {
    f.b.text(rect.x + 12, rect.y + ROW_H / 2, cw.editLabel, typeRole.rowTitle, {
      color: surface.ink.hex,
      origin: [0, 0.5],
      size: 13,
      fitWidth: rect.width - 24,
    });
    press(f, `modular:${EDIT_SCENARIO_ID}`, r, on.editScenario, { scroll: "page" });
    return;
  }
  nameText(f.b, rect.x + 12, rect.y + 11, rect.width - 24, row.label, 13);
  labelText(f.b, rect.x + 12, rect.y + 29, row.value, surface.ink.hex, { fitWidth: rect.width - 24 });
}

/** One of The Hood's own candidates as a toggle row. */
export function hoodRow(f: Frame, on: ModularsEvents, rect: Rect, option: HoodModularSetOption): void {
  toggleRow(f, rect, {
    key: `hoodSet:${option.id}`,
    selected: option.included,
    name: option.name,
    meta: hoodMeta(option),
    run: () => on.toggleHood(option.id),
  });
}
