/**
 * The set-cards sheet with its cards in sections (`scenes/set-cards.ts`): Table setup's Standard set sheet lists
 * Standard I, II and III one after another, each under its own heading, in one popup. The columns, cell size, close
 * button and footer follow `setSheetLayout`; the body stacks each section's heading over its own rows of cards.
 */
import { setSheetLayout, type SetSheetLayout } from "./civil-war-builder-layout.js";
import type { Rect } from "./layout.js";

/** A section's heading: the set's name and where it comes from, on one or two lines. */
export const SECTION_HEADING_HEIGHT = 40;
const SECTION_GAP = 14;
const GAP = 10;

export interface SectionedSheetLayout extends SetSheetLayout {
  /** Each section's heading, in content space (from `body.y`, unscrolled). */
  readonly headings: readonly Rect[];
  /** Each section's card cells, in content space. */
  readonly sectionCells: readonly (readonly Rect[])[];
}

export interface SectionedSheetOptions {
  /** Leave room for each section's heading (false: one plain set). Default true. */
  readonly headed?: boolean;
  /** Extra header height for a subtitle that wraps past one line. Default 0. */
  readonly extraHeader?: number;
  /** Keep the footer for an action button. Default true; without it the cards run to the panel's foot. */
  readonly footer?: boolean;
}

/** The sheet for sections of `counts[i]` cards each. */
export function sectionedSheetLayout(
  viewport: { width: number; height: number },
  counts: readonly number[],
  cardScale = 1,
  options: SectionedSheetOptions = {},
): SectionedSheetLayout {
  const headed = options.headed ?? true;
  const headingHeight = headed ? SECTION_HEADING_HEIGHT : 0;
  // The plain layout for every card at once sets the panel width, the columns and the cell size.
  const total = counts.reduce((sum, n) => sum + n, 0);
  const base = setSheetLayout(viewport, Math.max(1, total), cardScale);
  const columns = base.columns;
  const cellW = base.cells[0]?.width ?? base.body.width;
  const cellH = base.cells[0]?.height ?? base.imageHeight;
  const headerHeight = base.header.height + (options.extraHeader ?? 0);
  const footerHeight = (options.footer ?? true) ? base.footer.height : 8;

  // Content heights first (relative to the body's top), then the panel that holds them.
  const offsets: { heading: number; cells: number[] }[] = [];
  let y = 0;
  counts.forEach((count, index) => {
    if (index > 0) y += SECTION_GAP;
    const heading = y;
    y += headingHeight;
    const cells: number[] = [];
    for (let i = 0; i < count; i++) cells.push(y + Math.floor(i / columns) * (cellH + GAP));
    const rows = Math.ceil(count / columns);
    y += rows === 0 ? 0 : rows * cellH + (rows - 1) * GAP;
    offsets.push({ heading, cells });
  });
  const contentHeight = y;

  const margin = viewport.width < 520 ? 8 : 24;
  const maxHeight = Math.min(viewport.height - margin * 2, 640);
  const height = Math.min(
    maxHeight,
    headerHeight + contentHeight + 4 + footerHeight + ((options.footer ?? true) ? 8 : 0),
  );
  const panel: Rect = { ...base.panel, y: Math.round((viewport.height - height) / 2), height };
  const header: Rect = { ...base.header, y: panel.y, height: headerHeight };
  const close: Rect = { ...base.close, y: panel.y + 8 };
  const footer: Rect = { ...base.footer, y: panel.y + height - footerHeight };
  const action: Rect = { ...base.action, y: footer.y + 8 };
  const bodyTop = header.y + headerHeight;
  const body: Rect = { ...base.body, y: bodyTop, height: footer.y - bodyTop - 4 };
  const headings = offsets.map((o) => ({
    x: body.x,
    y: bodyTop + o.heading,
    width: body.width,
    height: headingHeight,
  }));
  const sectionCells = offsets.map((o) =>
    o.cells.map((top, i) => ({
      x: body.x + (i % columns) * (cellW + GAP),
      y: bodyTop + top,
      width: cellW,
      height: cellH,
    })),
  );
  return {
    ...base,
    panel,
    header,
    close,
    footer,
    action,
    body,
    cells: sectionCells.flat(),
    contentHeight,
    headings,
    sectionCells,
  };
}
