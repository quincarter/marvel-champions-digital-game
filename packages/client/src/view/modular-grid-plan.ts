/**
 * Table setup's modular grid as plain geometry: sections (an optional small label, then rows of equal tiles), laid out
 * top to bottom in the grid's own space (origin at its top-left). With dozens of sets the plan is taller than the
 * panel, so the scene draws it inside a scroll region; `rowHeights` and `rowOfItem` are what that region's scroll math
 * and "bring this tile into view" need. Pure: no Phaser.
 */
import type { Rect } from "./layout.js";

/** A section's label row, and the gap between the label and its first tile row. */
export const GROUP_LABEL_HEIGHT = 16;
export const GROUP_LABEL_GAP = 6;
/** The gap between the end of one section and the label of the next. */
export const GROUP_GAP = 12;

export interface ModularGridSection {
  readonly id: string;
  /** Null: no label row (the required sets, a restricted pool). */
  readonly label: string | null;
  readonly itemCount: number;
}

export interface ModularGridInput {
  readonly width: number;
  readonly columns: number;
  readonly cardHeight: number;
  readonly gap: number;
  readonly sections: readonly ModularGridSection[];
}

export interface ModularGridHeader {
  readonly sectionId: string;
  readonly label: string;
  readonly rect: Rect;
}

export interface ModularGridPlan {
  /** One rect per item, in section order, in grid space. */
  readonly cells: readonly Rect[];
  readonly headers: readonly ModularGridHeader[];
  /** One entry per row (label rows and tile rows, each with the space after it), summing to `contentHeight`. */
  readonly rowHeights: readonly number[];
  /** The `rowHeights` index each item's row is. */
  readonly rowOfItem: readonly number[];
  readonly contentHeight: number;
}

export function modularGridPlan(input: ModularGridInput): ModularGridPlan {
  const { width, columns, cardHeight, gap } = input;
  const cellWidth = (width - (columns - 1) * gap) / columns;
  const cells: Rect[] = [];
  const headers: ModularGridHeader[] = [];
  const rowHeights: number[] = [];
  const rowOfItem: number[] = [];
  let y = 0;
  let first = true;
  for (const section of input.sections) {
    if (section.itemCount === 0) continue;
    if (!first) {
      // The gap between sections belongs to the row above it.
      y += GROUP_GAP - gap;
      rowHeights[rowHeights.length - 1]! += GROUP_GAP - gap;
    }
    first = false;
    if (section.label !== null) {
      headers.push({
        sectionId: section.id,
        label: section.label,
        rect: { x: 0, y, width, height: GROUP_LABEL_HEIGHT },
      });
      rowHeights.push(GROUP_LABEL_HEIGHT + GROUP_LABEL_GAP);
      y += GROUP_LABEL_HEIGHT + GROUP_LABEL_GAP;
    }
    const rows = Math.ceil(section.itemCount / columns);
    for (let row = 0; row < rows; row++) {
      rowHeights.push(cardHeight + gap);
      for (let col = 0; col < columns; col++) {
        if (row * columns + col >= section.itemCount) break;
        cells.push({ x: col * (cellWidth + gap), y, width: cellWidth, height: cardHeight });
        rowOfItem.push(rowHeights.length - 1);
      }
      y += cardHeight + gap;
    }
  }
  // No trailing gap after the last row.
  if (rowHeights.length > 0) rowHeights[rowHeights.length - 1]! -= gap;
  const contentHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  return { cells, headers, rowHeights, rowOfItem, contentHeight };
}
