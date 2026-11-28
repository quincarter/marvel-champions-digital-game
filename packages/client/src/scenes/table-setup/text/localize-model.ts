/** The view model with its words in the app language (`lt`): English passes through unchanged. */
import { artLanguageNow } from "../../../art/art-source.js";
import type { OptionChip, SetupOptionRow } from "../../../view/setup-options.js";
import type { TableModel } from "../model.js";
import { lt } from "./lt.js";

const chip = (c: OptionChip): OptionChip => ({ ...c, label: lt(c.label) });

function row(r: SetupOptionRow): SetupOptionRow {
  const control =
    r.control.kind === "stepper"
      ? { ...r.control, down: chip(r.control.down), up: chip(r.control.up), valueLabel: lt(r.control.valueLabel) }
      : r.control.kind === "groups"
        ? {
            ...r.control,
            groups: r.control.groups.map((g) => ({
              ...g,
              ...(g.label ? { label: lt(g.label) } : {}),
              chips: g.chips.map(chip),
            })),
          }
        : r.control;
  return { ...r, name: lt(r.name), meta: lt(r.meta), control } as SetupOptionRow;
}

export function localizeModel(m: TableModel): TableModel {
  if (artLanguageNow() === "en") return m;
  return {
    ...m,
    villainName: lt(m.villainName),
    difficultyCards: m.difficultyCards.map((c) => ({ ...c, name: lt(c.name), description: lt(c.description) })),
    setChoices: m.setChoices.map(row),
    optionRows: m.optionRows.map(row),
    allOptionRows: m.allOptionRows.map(row),
    requiredSets: m.requiredSets.map((r) => ({ ...r, name: lt(r.name) })),
    modularOptions: m.modularOptions.map((o) => ({
      ...o,
      name: lt(o.name),
      groupLabel: o.groupLabel === null ? null : lt(o.groupLabel),
      disabledReason: o.disabledReason === null ? null : lt(o.disabledReason),
    })),
    hoodOptions: m.hoodOptions.map((o) => ({ ...o, name: lt(o.name) })),
    cw: m.cw
      ? {
          ...m.cw,
          rows: m.cw.rows.map((r) => ({ ...r, label: lt(r.label), value: lt(r.value) })),
          build: lt(m.cw.build),
        }
      : null,
    compositionRows: m.compositionRows.map((r) => ({
      ...r,
      label: lt(r.label),
      ...(r.shown ? { shown: lt(r.shown) } : {}),
    })),
    whatsInThereRows: m.whatsInThereRows.map((r) => ({
      ...r,
      label: lt(r.label),
      ...(r.shown ? { shown: lt(r.shown) } : {}),
    })),
    nemesis: m.nemesis ? { ...m.nemesis, sentence: lt(m.nemesis.sentence) } : null,
    summaryRows: m.summaryRows.map((r) => ({ label: lt(r.label), value: lt(r.value) })),
    modularRight: lt(m.modularRight),
    seats: m.seats.map((s) => ({ ...s, name: lt(s.name) })),
  };
}
