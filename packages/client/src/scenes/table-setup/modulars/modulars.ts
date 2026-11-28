/**
 * The Modular sets section: the header with its Random draw, the picker (the scenario's required set(s), then every
 * candidate under its group's label; a Civil War build's read-only summary in its place) and The Hood's own set-aside
 * sets. It draws what `ModularsInput` says and raises `ModularsEvents`; it reads no other section's state.
 */
import type { Rect } from "../../../view/layout.js";
import { surface } from "../../../tokens.js";
import type { ModularGridPlan } from "../../../view/modular-grid-plan.js";
import { ROW_GAP, type TableSetupCompactLayout } from "../../../view/table-setup-layout.js";
import {
  compactModularEntriesFor,
  groupStartsOpen,
  modularGroupsOf,
  type ModularGroupSummary,
} from "../../../view/modular-sets.js";
import { SUMMARY_SECTION_TITLE } from "../../../view/civil-war-table-summary.js";
import { t } from "../../../i18n/translate.js";
import { button, heading, labelText, type Frame } from "../shared/frame.js";
import { hoodRow, groupRow, modularRow, requiredRow, summaryRow } from "./rows.js";
import { hoodTile, modularTile, requiredTile, summaryTile } from "./tiles.js";
import type { ModularsEvents, ModularsInput } from "./modulars.types.js";

/** The Random button beside the section's header. */
export const MODULAR_RANDOM_WIDTH = 90;
/** The scrolling grid's key. */
export const GRID = "grid";

export interface ModularsLayout {
  readonly wide: boolean;
  readonly header: Rect;
  readonly grid: Rect;
  readonly plan: ModularGridPlan;
  readonly scrolls: boolean;
  readonly hoodHeader: Rect;
  readonly hoodGrid: Rect;
  readonly hoodColumns: number;
  readonly hoodRows: number;
}

/** The phone's rows for the picker: its groups, whether each is showing, and the entries the layout lists. */
export function compactModulars(input: ModularsInput) {
  const groups = modularGroupsOf(input.options);
  const open = (group: ModularGroupSummary): boolean => input.openGroups.get(group.id) ?? groupStartsOpen(group);
  return {
    entries: compactModularEntriesFor(input.options, open),
    groups: new Map(groups.map((group) => [group.id, { group, open: open(group) }])),
  };
}

/** The wide and tablet-portrait section. `body` is the ground's ink or paper text colour. */
export function drawModulars(
  f: Frame,
  input: ModularsInput,
  on: ModularsEvents,
  layout: ModularsLayout,
  body: number,
): void {
  const h = layout.header;
  if (input.randomSets)
    button(
      f,
      "modular:random-draw",
      { x: h.x + h.width - MODULAR_RANDOM_WIDTH, y: h.y, width: MODULAR_RANDOM_WIDTH, height: h.height },
      t("tableSetup.random"),
      on.random,
    );
  heading(
    f.b,
    h.x,
    h.y,
    h.width - (input.randomSets ? MODULAR_RANDOM_WIDTH + 10 : 0),
    input.cw ? SUMMARY_SECTION_TITLE : t("tableSetup.modular"),
    body,
    input.right.toUpperCase(),
  );
  const { grid, plan } = layout;
  const draw = (inner: Frame, top: number, scroll?: string): void => {
    const cell = (i: number): Rect => {
      const p = plan.cells[i]!;
      return { x: grid.x + p.x, y: top + p.y, width: p.width, height: p.height };
    };
    if (input.cw) {
      for (let i = 0; i <= input.cw.rows.length; i++) summaryTile(inner, on, cell(i), input.cw, i);
      return;
    }
    let i = 0;
    for (const required of input.required) requiredTile(inner, cell(i++), required, input.villainName);
    for (const label of plan.headers)
      labelText(inner.b, grid.x + label.rect.x, top + label.rect.y, label.label, body, { fitWidth: label.rect.width });
    for (const option of input.options) modularTile(inner, on, cell(i++), option, scroll);
  };
  // A tall plan scrolls natively inside a panel the size of the grid.
  if (layout.scrolls) f.b.scroll(GRID, grid, plan.contentHeight, (b) => draw(f.into(b), 0, GRID));
  else draw(f, grid.y);

  if (layout.wide && layout.hoodHeader.height > 0 && input.hood.length > 0) {
    const included = input.hood.filter((o) => o.included).length;
    const hh = layout.hoodHeader;
    heading(
      f.b,
      hh.x,
      hh.y,
      hh.width,
      t("tableSetup.hoodTitle"),
      body,
      t("tableSetup.hoodCount", { included, total: input.hood.length }).toUpperCase(),
    );
    const g = layout.hoodGrid;
    const cols = layout.hoodColumns;
    const cellH = layout.hoodRows > 0 ? (g.height - (layout.hoodRows - 1) * ROW_GAP) / layout.hoodRows : g.height;
    const cellW = (g.width - (cols - 1) * ROW_GAP) / cols;
    input.hood.forEach((option, i) =>
      hoodTile(
        f,
        on,
        {
          x: g.x + (i % cols) * (cellW + ROW_GAP),
          y: g.y + Math.floor(i / cols) * (cellH + ROW_GAP),
          width: cellW,
          height: cellH,
        },
        option,
      ),
    );
  }
}

/** One of the section's phone rows, by the layout's row id; true when the id was one of its own. */
export function drawCompactModulars(
  f: Frame,
  input: ModularsInput,
  on: ModularsEvents,
  id: string,
  rect: Rect,
  layout: Pick<TableSetupCompactLayout, "modularHeaderStacked">,
): boolean {
  const compact = compactModulars(input);
  if (id === "header:modular") {
    const title = input.cw ? SUMMARY_SECTION_TITLE : t("tableSetup.modular");
    const room = rect.width - (input.randomSets ? MODULAR_RANDOM_WIDTH + 10 : 0);
    const right = input.right.toUpperCase();
    if (input.randomSets)
      button(
        f,
        "modular:random-draw",
        { x: rect.x + rect.width - MODULAR_RANDOM_WIDTH, y: rect.y, width: MODULAR_RANDOM_WIDTH, height: 30 },
        t("tableSetup.random"),
        on.random,
        { scroll: "page" },
      );
    if (!layout.modularHeaderStacked) heading(f.b, rect.x, rect.y + 2, room, title, surface.ink.hex, right);
    else {
      // The label wraps under the heading, in the row's own taller height: it says which sets will be in the deck.
      heading(f.b, rect.x, rect.y + 2, room, title, surface.ink.hex);
      labelText(f.b, rect.x, rect.y + 28, right, surface.ink.hex, { wrapWidth: rect.width });
    }
    return true;
  }
  if (id.startsWith("modulargroup:")) {
    const entry = compact.groups.get(id.slice("modulargroup:".length));
    if (entry) groupRow(f, on, rect, entry.group, entry.open);
    return true;
  }
  if (id.startsWith("modular:")) {
    const setId = id.slice("modular:".length);
    if (input.cw) {
      summaryRow(f, on, rect, input.cw, setId);
      return true;
    }
    const required = input.required.find((r) => (r.id as string) === setId);
    const option = input.options.find((o) => o.id === setId);
    if (required) requiredRow(f, rect, required, input.villainName);
    else if (option) modularRow(f, on, rect, option);
    return true;
  }
  if (id === "header:hoodSets") {
    heading(
      f.b,
      rect.x,
      rect.y + 2,
      rect.width,
      t("tableSetup.hoodTitle"),
      surface.ink.hex,
      t("tableSetup.hoodChoose"),
    );
    return true;
  }
  if (id.startsWith("hoodSet:")) {
    const option = input.hood.find((o) => o.id === id.slice("hoodSet:".length));
    if (option) hoodRow(f, on, rect, option);
    return true;
  }
  return false;
}
