/**
 * Table setup (docs/phase4-screen-gaps.md §3 W2, D05/P12), composition read
 * off `docs/design-renders/ScreensDesktop_04-05.png` and
 * `ScreensPhone_02.png`:
 *
 * The same full-width **ink** header bar as Scenario select/Take your seats.
 * Below it, on tablet/desktop, the screen splits side by side: a **paper**
 * body panel (~62%) carrying Difficulty, the modular set picker (dark ink
 * tiles of their own, red-bordered when chosen) and Seating/first player,
 * beside a persistent **ink** sidebar (~38%) carrying "the encounter deck
 * you're building" (S3), "the game you'll get"
 * (`view/table-setup-preview.ts`), the seed field with Reroll, and the one
 * red action, "Deal it out", at the sidebar's own foot. On phone there's no
 * room for two columns, so the sidebar drops below the body instead —
 * everything else the same, ink ground and all.
 *
 * The two info panels are still a variable number of text lines (an
 * encounter deck's own set/type breakdown, a multi-villain scenario's own
 * longer "game you'll get"), so the same "lay out once, measure the overflow,
 * trim panel line budgets first" rule `view/scenario-select-layout.ts` uses
 * applies here too, independently for the body and the sidebar since they
 * scroll to their own bottoms.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { LABEL_ROOM, setupColumnWidth, setupMetrics } from "./setup-metrics.js";

export const PANEL_LINE_HEIGHT = 18;
export const HEADER_HEIGHT = 64;
const SIDEBAR_SHARE = 0.38;
const GUTTER = 24;

export interface TableSetupLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly difficultyCount: number;
  readonly modularRows: number;
  readonly encounterLines: number;
  readonly gameLines: number;
}

export interface TableSetupLayout {
  readonly pad: number;
  readonly left: number;
  readonly column: number;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  /** The paper body panel's own bounds (full width on phone, ~62% on tablet/desktop). */
  readonly bodyPanel: Rect;
  /** The ink sidebar's own bounds (full width, below the body, on phone). */
  readonly sidebar: Rect;
  readonly split: boolean;
  readonly difficulty: Rect;
  readonly modular: Rect;
  readonly modularRows: number;
  readonly seating: Rect;
  readonly encounterPreview: Rect;
  readonly encounterLines: number;
  readonly gamePreview: Rect;
  readonly gameLines: number;
  readonly seed: Rect;
  readonly reroll: Rect;
  readonly dealItOut: Rect;
}

export function tableSetupLayoutRects(layout: TableSetupLayout): readonly Rect[] {
  return [
    layout.back,
    layout.step,
    layout.difficulty,
    layout.modular,
    layout.seating,
    layout.encounterPreview,
    layout.gamePreview,
    layout.seed,
    layout.reroll,
    layout.dealItOut,
  ];
}

interface Sizing {
  readonly split: boolean;
  readonly bodyPanel: Rect;
  readonly sidebar: Rect;
  readonly bodyLeft: number;
  readonly bodyWidth: number;
  readonly sidebarLeft: number;
  readonly sidebarWidth: number;
}

function sizingFor(width: number, height: number, headerHeight: number): Sizing {
  const { phone, pad } = setupMetrics(width, height);
  const split = !phone;
  const bodyTop = headerHeight;
  if (!split) {
    const column = setupColumnWidth(width, height);
    const left = (width - column) / 2;
    return {
      split,
      bodyPanel: { x: 0, y: bodyTop, width, height: 0 },
      sidebar: { x: 0, y: bodyTop, width, height: 0 },
      bodyLeft: left,
      bodyWidth: column,
      sidebarLeft: left,
      sidebarWidth: column,
    };
  }
  const sidebarWidthOuter = Math.round(width * SIDEBAR_SHARE);
  const bodyWidthOuter = width - sidebarWidthOuter;
  return {
    split,
    bodyPanel: { x: 0, y: bodyTop, width: bodyWidthOuter, height: 0 },
    sidebar: { x: bodyWidthOuter, y: bodyTop, width: sidebarWidthOuter, height: 0 },
    bodyLeft: pad,
    bodyWidth: bodyWidthOuter - pad * 2,
    sidebarLeft: bodyWidthOuter + pad,
    sidebarWidth: sidebarWidthOuter - pad * 2,
  };
}

function layoutAt(input: TableSetupLayoutInput, encounterLines: number, gameLines: number): TableSetupLayout {
  const { width, height } = input;
  const { pad, gap, smallGap } = setupMetrics(width, height);
  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 70;
  const stepWidth = Math.min(160, Math.max(90, width * 0.32));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const sizing = sizingFor(width, height, HEADER_HEIGHT);

  // Body column: Difficulty, modular sets, seating.
  let by = HEADER_HEIGHT + pad;
  const left = sizing.bodyLeft;
  const column = sizing.bodyWidth;
  by += LABEL_ROOM;
  const difficulty: Rect = { x: left, y: by, width: column, height: hit.target };
  by += hit.target + gap;
  by += LABEL_ROOM;
  const modularHeight = Math.max(0, input.modularRows) * hit.target + Math.max(0, input.modularRows - 1) * 6;
  const modular: Rect = { x: left, y: by, width: column, height: modularHeight };
  by += modularHeight + gap;
  by += LABEL_ROOM;
  const seating: Rect = { x: left, y: by, width: column, height: hit.target };
  by += hit.target + gap;
  const bodyPanel: Rect = { ...sizing.bodyPanel, height: (sizing.split ? by : by) - HEADER_HEIGHT + pad };

  // Sidebar column: encounter preview, game preview, seed, Deal it out. Starts right after the body on phone.
  // Each panel's own heading ("THE ENCOUNTER DECK YOU'RE BUILDING", "THE GAME YOU'LL GET") is drawn `LABEL_ROOM`
  // above it (`scenes/table-setup.ts`), so both need that much room reserved ahead of them, same as every other
  // labelled control on these four setup screens.
  let sy = (sizing.split ? HEADER_HEIGHT + pad : by + GUTTER) + LABEL_ROOM;
  const sLeft = sizing.sidebarLeft;
  const sWidth = sizing.sidebarWidth;
  const encounterHeight = Math.max(PANEL_LINE_HEIGHT, encounterLines * PANEL_LINE_HEIGHT);
  const encounterPreview: Rect = { x: sLeft, y: sy, width: sWidth, height: encounterHeight };
  sy += encounterHeight + smallGap + LABEL_ROOM;
  const gameHeight = Math.max(PANEL_LINE_HEIGHT, gameLines * PANEL_LINE_HEIGHT);
  const gamePreview: Rect = { x: sLeft, y: sy, width: sWidth, height: gameHeight };
  sy += gameHeight + gap;
  const rerollWidth = 110;
  const seedWidth = sWidth - rerollWidth - 10;
  const seed: Rect = { x: sLeft, y: sy, width: seedWidth, height: hit.target };
  const reroll: Rect = { x: sLeft + seedWidth + 10, y: sy, width: rerollWidth, height: hit.target };
  sy += hit.target + gap;
  const dealItOut: Rect = { x: sLeft, y: sy, width: sWidth, height: hit.primary };
  sy += hit.primary + pad;
  const sidebar: Rect = { ...sizing.sidebar, height: sy - sizing.sidebar.y };

  return {
    pad,
    left,
    column,
    headerBar,
    back,
    step,
    bodyPanel,
    sidebar,
    split: sizing.split,
    difficulty,
    modular,
    modularRows: input.modularRows,
    seating,
    encounterPreview,
    encounterLines,
    gamePreview,
    gameLines,
    seed,
    reroll,
    dealItOut,
  };
}

export function tableSetupLayout(input: TableSetupLayoutInput): TableSetupLayout {
  const trial = layoutAt(input, input.encounterLines, input.gameLines);
  const bottom = trial.split ? Math.max(trial.bodyPanel.y + trial.bodyPanel.height, trial.sidebar.y + trial.sidebar.height) : trial.sidebar.y + trial.sidebar.height;
  const overflow = bottom - input.height;
  if (overflow <= 0) return trial;
  let encounterLines = input.encounterLines;
  let gameLines = input.gameLines;
  let remaining = overflow;
  while (remaining > 0 && (encounterLines > 1 || gameLines > 1)) {
    if (encounterLines >= gameLines && encounterLines > 1) encounterLines -= 1;
    else if (gameLines > 1) gameLines -= 1;
    else break;
    remaining -= PANEL_LINE_HEIGHT;
  }
  return layoutAt(input, encounterLines, gameLines);
}
