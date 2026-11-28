/** Works out which of the page's two compositions fits the screen, and its layout, from the view model. */
import { estimateWrappedLines } from "../../../view/layout.js";
import { EDIT_SCENARIO_ID } from "../../../view/civil-war-table-summary.js";
import { modularSectionsFor } from "../../../view/modular-sets.js";
import { isSetChoiceRow } from "../../../view/setup-options.js";
import {
  COMPACT_NAMED_STEPPER_HEIGHT,
  COMPACT_SET_CHOICE_HEIGHT,
  compactOptionHeight,
  tableSetupCompactLayout,
  tableSetupLayout,
  type TableSetupCompactLayout,
  type TableSetupLayout,
} from "../../../view/table-setup-layout.js";
import type { TableModel } from "../model.js";
import { compactModulars } from "../modulars/modulars.js";
import type { ModularsInput } from "../modulars/modulars.types.js";

export type PageLayout =
  | { readonly kind: "wide"; readonly layout: TableSetupLayout }
  | { readonly kind: "compact"; readonly layout: TableSetupCompactLayout };

export function pageLayoutOf(width: number, height: number, m: TableModel, modulars: ModularsInput): PageLayout {
  const { draft, cw } = m;
  // The nemesis panel's own line count: the wrapped sentence plus one foot line, against about a third of the body width.
  const nemesisLines = m.nemesis
    ? estimateWrappedLines(m.nemesis.sentence, Math.max(160, width / 3.4 - 24), 5.4) + 1
    : 0;
  const wide = tableSetupLayout({
    width,
    height,
    difficultyCount: m.difficultyCards.length,
    modularCardCount: cw ? cw.rows.length + 1 : m.requiredSets.length + m.modularOptions.length,
    ...(cw ? {} : { modularSections: modularSectionsFor(m.requiredSets.length, m.modularOptions) }),
    seatCount: draft.seats.length,
    compositionRows: m.compositionRows.length,
    whatsInThereRows: m.whatsInThereRows.length,
    nemesisLines,
    optionSpans: m.optionRows.map((row) => row.span),
    optionGroupCounts: m.optionRows.map((row) => (row.control.kind === "groups" ? row.control.groups.length : 0)),
    setChoiceRows: m.setChoices.length,
    hasTowerDefenseSetupDamage: m.towerDefense,
    hoodSetCount: m.hoodOptions.length,
  });
  // Every touch form factor gets the scrolling page, and a wide window too short to keep two tile rows and two panel rows.
  if (!wide.scrollsPage) return { kind: "wide", layout: wide };
  const { entries } = compactModulars(modulars);
  const candidates = cw ? [...cw.rows.map((r) => r.id), EDIT_SCENARIO_ID] : m.modularOptions.map((o) => o.id);
  const layout = tableSetupCompactLayout({
    width,
    height,
    difficultyIds: m.difficultyCards.map((c) => c.id),
    requiredModularIds: m.requiredSets.map((r) => r.id as string),
    candidateModularIds: candidates,
    candidateModularEntries: cw ? candidates.map((id) => ({ kind: "set" as const, id })) : entries,
    modularHeaderRightLabel: m.modularRight.toUpperCase(),
    // The set choices keep their rows (a name and 44px chips each); the other options follow.
    optionRows: [...m.setChoices, ...m.optionRows].map((row) => ({
      id: row.id,
      height: isSetChoiceRow(row)
        ? COMPACT_SET_CHOICE_HEIGHT
        : row.control.kind === "stepper" && row.control.wide
          ? COMPACT_NAMED_STEPPER_HEIGHT
          : compactOptionHeight(row.control.kind, row.control.kind === "groups" ? row.control.groups.length : 1),
    })),
    hasTowerDefenseSetupDamage: m.towerDefense,
    hoodSetIds: m.hoodOptions.map((o) => o.id),
    seatCount: draft.seats.length,
    compositionRows: m.compositionRows.length,
    whatsInThereRows: m.whatsInThereRows.length,
    hasNemesisStandby: m.nemesis !== null,
  });
  return { kind: "compact", layout };
}
