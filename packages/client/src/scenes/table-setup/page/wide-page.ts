/**
 * The page on a wide screen or a tablet in portrait: the paper body beside the ink sidebar (wide) or one ink page (tablet
 * portrait), laid out by `view/table-setup-layout.ts`, with the five sections drawn into it.
 */
import type Phaser from "phaser";
import { dotGrid, surface } from "../../../tokens.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import type { TableSetupLayout } from "../../../view/table-setup-layout.js";
import type { Frame } from "../shared/frame.js";
import { drawDifficulty } from "../difficulty/difficulty.js";
import { drawEncounter } from "../encounter/encounter.js";
import { drawModulars } from "../modulars/modulars.js";
import { drawSeating } from "../seating/seating.js";
import { drawSummary } from "../summary/summary.js";
import type { SectionEvents, SectionInputs } from "./sections.js";
import { topBar } from "./top-bar.js";

export function drawWidePage(
  f: Frame,
  glyphs: SheetGlyphs,
  scene: Phaser.Scene,
  layout: TableSetupLayout,
  size: { readonly width: number; readonly height: number },
  inputs: SectionInputs,
  on: SectionEvents,
): void {
  const { b } = f;
  const bar = layout.headerBar;
  // Ground: paper body (dot grid) under the ink header, beside the ink sidebar on wide; one ink page on tablet portrait.
  b.box({ x: 0, y: 0, ...size }, { fill: layout.wide ? surface.paper.hex : surface.ink.hex });
  const dots = layout.wide ? dotGrid.onPaper : dotGrid.onInk;
  b.dots(
    { x: 0, y: bar.height, width: size.width, height: size.height - bar.height },
    layout.wide ? "paper" : "ink",
    dots.spacing,
    dots.radius,
    dots.alpha,
  );
  if (layout.wide) b.box(layout.sidebar!, { fill: surface.ink.hex });
  b.box(bar, { fill: surface.ink.hex });
  topBar(f, glyphs, scene, layout, false, on.back);
  // The body's own text colour: ink on the wide paper body, paper on the tablet-portrait ink page.
  const body = layout.wide ? surface.ink.hex : surface.paper.hex;

  drawDifficulty(
    f,
    inputs.difficulty,
    on.difficulty,
    {
      wide: layout.wide,
      header: layout.difficultyHeader,
      row: layout.difficultyRow,
      slots: layout.difficultySlots,
      setsCard: layout.setsCard,
      setsInline: layout.setsInline,
      optionCards: layout.optionCards,
      towerDefenseRow: layout.towerDefenseDamageRow,
    },
    body,
  );
  drawModulars(
    f,
    inputs.modulars,
    on.modulars,
    {
      wide: layout.wide,
      header: layout.modularHeader,
      grid: layout.modularGrid,
      plan: layout.modularPlan,
      scrolls: layout.modularScrolls,
      hoodHeader: layout.hoodHeader,
      hoodGrid: layout.hoodGrid,
      hoodColumns: layout.hoodColumns,
      hoodRows: layout.hoodRows,
    },
    body,
  );
  drawSeating(
    f,
    inputs.seating,
    on.seating,
    { wide: layout.wide, header: layout.seatingHeader, random: layout.randomControl, row: layout.seatingRow },
    body,
  );
  drawEncounter(
    f,
    inputs.encounter,
    {
      header: layout.encounterHeader,
      composition: layout.encounterPanels.composition,
      whatsInThere: layout.encounterPanels.whatsInThere,
      nemesis: layout.encounterPanels.nemesis,
      budgets: layout.encounterPanels.rowBudgets,
    },
    body,
  );
  drawSummary(f, glyphs, inputs.summary, on.summary, {
    wide: layout.wide,
    header: layout.gameSummaryHeader,
    rows: layout.gameSummaryRows,
    rule: layout.rule,
    seed: layout.seed,
    reroll: layout.reroll,
    seedHelper: layout.seedHelper,
    watch: layout.watch,
    dealItOut: layout.dealItOut,
  });
}
