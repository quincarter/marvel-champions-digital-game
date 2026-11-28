/**
 * A checkbox row on the phone (a candidate set, a Hood set, Tower Defense's toggle, the watch toggle): a paper card, a
 * ticked box when on, the name over a meta line. The tick and the words say the state, never colour alone.
 */
import type { Rect } from "../../../view/layout.js";
import { COMPACT_MODULAR_ROW_HEIGHT as ROW_H } from "../../../view/table-setup-layout.js";
import { surface } from "../../../tokens.js";
import { checkbox, inset, labelText, nameText, press, type Frame } from "./frame.js";

export interface ToggleRow {
  readonly key: string;
  readonly selected: boolean;
  readonly name: string;
  readonly meta: string;
  readonly run: () => void;
}

/** Draws the row at `rect` (its own height is `COMPACT_MODULAR_ROW_HEIGHT`); `right` ends the text early for a picture. */
export function toggleRow(f: Frame, rect: Rect, row: ToggleRow, right = rect.x + rect.width - 10): void {
  const r: Rect = { ...rect, height: ROW_H };
  f.b.box(r, { fill: surface.card.hex });
  f.b.box(inset(r, 1.25), { stroke: surface.ink.hex, strokeWidth: 2.5 });
  const box = checkbox(f.b, rect, ROW_H, row.selected, surface.ink.hex);
  const x = box.x + box.width + 11;
  nameText(f.b, x, rect.y + 11, right - x, row.name, 13);
  labelText(f.b, x, rect.y + 29, row.meta, surface.ink.hex, { fitWidth: right - x });
  press(f, row.key, r, row.run, { scroll: "page" });
}
