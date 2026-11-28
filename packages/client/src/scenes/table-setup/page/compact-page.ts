/**
 * The page on a phone: a scrolling paper page (rows at their own full height, the sections' phone rows) between the ink
 * top bar and a pinned footer with "Deal it out". The page scrolls natively; nothing sits over it.
 */
import type Phaser from "phaser";
import { surface } from "../../../tokens.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import { compactRowRects, type TableSetupCompactLayout } from "../../../view/table-setup-layout.js";
import { drawCompactDifficulty } from "../difficulty/difficulty.js";
import { drawCompactEncounter } from "../encounter/encounter.js";
import { drawCompactModulars } from "../modulars/modulars.js";
import { drawCompactSeating } from "../seating/seating.js";
import { drawCompactFooter, drawCompactSummary } from "../summary/summary.js";
import { heading, type Frame } from "../shared/frame.js";
import { t } from "../../../i18n/translate.js";
import type { SectionEvents, SectionInputs } from "./sections.js";
import { topBar } from "./top-bar.js";

/** The page scroller's key. */
export const PAGE = "page";

export function drawCompactPage(
  f: Frame,
  glyphs: SheetGlyphs,
  scene: Phaser.Scene,
  layout: TableSetupCompactLayout,
  size: { readonly width: number; readonly height: number },
  inputs: SectionInputs,
  on: SectionEvents,
): void {
  const { b } = f;
  b.box({ x: 0, y: 0, ...size }, { fill: surface.paper.hex });
  b.box(layout.headerBar, { fill: surface.ink.hex });
  topBar(f, glyphs, scene, layout, true, on.back);
  const rects = compactRowRects(layout);
  // The rows scroll in their own panel: their y is the page's own, their x the screen's.
  b.scroll(PAGE, layout.viewport, layout.contentHeight, (inner) => {
    const rows = f.into(inner);
    layout.rows.forEach((row, i) => {
      const rect = rects[i]!;
      if (row.id === "header:difficulty") {
        heading(inner, rect.x, rect.y + 2, rect.width, t("tableSetup.difficulty"), surface.ink.hex);
        return;
      }
      void (
        drawCompactDifficulty(rows, inputs.difficulty, on.difficulty, row.id, rect) ||
        drawCompactModulars(rows, inputs.modulars, on.modulars, row.id, rect, layout) ||
        drawCompactSeating(rows, inputs.seating, on.seating, row.id, rect) ||
        drawCompactSummary(rows, inputs.summary, on.summary, row.id, rect) ||
        drawCompactEncounter(rows, inputs.encounter, row.id, rect)
      );
    });
  });
  drawCompactFooter(f, glyphs, inputs.summary, on.summary, layout);
}
