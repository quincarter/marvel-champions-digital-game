/**
 * The "game you'll get" section: the engine's own summary of the game being set up (label over value, paper on ink), the
 * shuffle seed with Reroll, the watch toggle, the villain's picture and the one red action, "Deal it out". On the phone
 * the same things are a seed row, a watch row and a sticky footer. It draws `SummaryInput` and raises `SummaryEvents`.
 */
import type { Rect } from "../../../view/layout.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import {
  COMPACT_SEED_ROW_HEIGHT,
  GAME_SUMMARY_ROW_COUNT,
  PANEL_ROW_HEIGHT,
  type TableSetupCompactLayout,
} from "../../../view/table-setup-layout.js";
import { hit } from "../../../tokens.js";
import { t } from "../../../i18n/translate.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import { heading, inset, labelText, nameText, type Frame } from "../shared/frame.js";
import { toggleRow } from "../shared/toggle-row.js";
import { dealButton, seedField, villainPicture, watchToggle } from "./parts.js";
import type { SummaryEvents, SummaryInput } from "./summary.types.js";

/** Where the wide and tablet-portrait layouts put the section's parts (`TableSetupLayout`). */
export interface SummaryLayout {
  readonly wide: boolean;
  readonly header: Rect;
  readonly rows: Rect;
  readonly rule: Rect;
  readonly seed: Rect;
  readonly reroll: Rect;
  readonly seedHelper: Rect;
  readonly watch: Rect;
  readonly dealItOut: Rect;
}

/** The whole section on a wide screen or a tablet in portrait (always paper on ink). */
export function drawSummary(
  f: Frame,
  glyphs: SheetGlyphs,
  input: SummaryInput,
  on: SummaryEvents,
  layout: SummaryLayout,
): void {
  const paper = surface.paper.hex;
  heading(f.b, layout.header.x, layout.header.y, layout.header.width, t("tableSetup.summary"), paper);
  const rows = layout.rows;
  input.rows.slice(0, GAME_SUMMARY_ROW_COUNT).forEach((row, index) => {
    const y = rows.y + index * PANEL_ROW_HEIGHT;
    if (y + PANEL_ROW_HEIGHT > rows.y + rows.height + 0.01) return;
    const name = labelText(f.b, rows.x, y + 2, row.label, paper);
    // Whatever the label leaves, never less than 45%: a long value keeps its size instead of shrinking.
    f.b.text(
      rows.x + rows.width,
      y,
      row.value,
      { ...typeRole.emphasis, weight: 700 },
      {
        color: paper,
        origin: [1, 0],
        fitWidth: Math.max(rows.width * 0.45, rows.width - name.width - 10),
      },
    );
  });
  if (layout.rule.height > 0) f.b.box(layout.rule, { fill: paper, alpha: ink.disabled });
  seedField(f, input, on, layout.seed, layout.reroll);
  watchToggle(f, input, on, layout.watch);
  const help = layout.seedHelper;
  if (help.height > 8)
    f.b.text(help.x, help.y, t("tableSetup.seedHelp"), typeRole.body, {
      color: paper,
      alpha: ink.label,
      wrapWidth: help.width,
      maxLines: Math.max(1, Math.floor(help.height / 15)),
    });
  const top = help.y + 64;
  villainPicture(f, input, {
    x: help.x,
    y: top,
    width: help.width,
    height: (layout.wide ? layout.watch.y : layout.dealItOut.y) - 30 - top,
  });
  dealButton(f, glyphs, input, on, layout.dealItOut, {
    statusColor: paper,
    statusX: layout.dealItOut.x,
    outline: false,
  });
}

/** One of the section's phone rows, by the layout's row id; true when the id was one of its own. */
export function drawCompactSummary(f: Frame, input: SummaryInput, on: SummaryEvents, id: string, rect: Rect): boolean {
  if (id === "header:seed") {
    heading(f.b, rect.x, rect.y + 2, rect.width, t("tableSetup.seed"), surface.ink.hex);
    return true;
  }
  if (id === "seed") {
    const h = COMPACT_SEED_ROW_HEIGHT;
    f.b.box({ ...rect, height: h }, { fill: surface.parchment.hex });
    f.b.box(inset({ ...rect, height: h }, 1.25), { stroke: surface.ink.hex, strokeWidth: 2.5 });
    nameText(f.b, rect.x + 12, rect.y + 8, rect.width - 24, t("tableSetup.seed"), 15);
    f.b.text(rect.x + 12, rect.y + 26, t("tableSetup.seedCaption"), typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.label,
    });
    const rerollWidth = 90;
    const y = rect.y + 48;
    const field: Rect = { x: rect.x + 12, y, width: rect.width - 24 - rerollWidth - 10, height: hit.target };
    const reroll: Rect = { x: field.x + field.width + 10, y, width: rerollWidth, height: hit.target };
    seedField(f, input, on, field, reroll, "page");
    return true;
  }
  if (id === "watch") {
    toggleRow(f, rect, {
      key: "watch",
      selected: input.watchable,
      name: t("tableSetup.watch"),
      meta: t(input.watchable ? "live.setup.on" : "live.setup.off"),
      run: on.toggleWatch,
    });
    return true;
  }
  return false;
}

/** The phone's pinned footer: one summary line, then the red "Deal it out" with its paper outline. */
export function drawCompactFooter(
  f: Frame,
  glyphs: SheetGlyphs,
  input: SummaryInput,
  on: SummaryEvents,
  layout: Pick<TableSetupCompactLayout, "footer" | "footerSummary" | "dealItOut">,
): void {
  f.b.box(layout.footer, { fill: surface.ink.hex });
  labelText(f.b, layout.footerSummary.x, layout.footerSummary.y, input.footerLine, surface.paper.hex, {
    fitWidth: layout.footerSummary.width,
  });
  dealButton(f, glyphs, input, on, layout.dealItOut, {
    statusColor: surface.paper.hex,
    statusX: layout.footerSummary.x,
    outline: true,
  });
}
