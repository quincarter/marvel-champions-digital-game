/**
 * The Controls screen's layout (`scenes/controls.ts`; Settings ▸ Controls): an ink title bar with a boxed ✕, a
 * parchment tab rail (CONTROLLER | KEYBOARD) with the pad's status line at its right, and one scroll region under
 * them. Wide screens put the controller drawing and its caption in a left column and the settings group, the BUTTONS
 * list and the footer in a right column; a phone stacks them in that order and scrolls. Pure rects, no text
 * measurement beyond a wrap estimate, so it is testable without a canvas (the rule `settings-layout.ts` follows).
 *
 * Content rects are in content space (`y` from the scroll region's top); `viewport` and the chrome are screen space.
 */
import { hit } from "../tokens.js";
import type { ControlsTab, DrawingKind } from "./controls-rows.js";
import { estimateWrappedLines, formFactorFor, toggleRowHeight, type Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";

export const CONTROLS_HEADER_HEIGHT = 60;
const PANEL_MAX_WIDTH = 1120;
const PAD_X = 20;
const TAB_WIDTH = 150;
/** Wide enough for two columns: the drawing beside the list. */
export const TWO_COLUMN_MIN_WIDTH = 820;
const COLUMN_GAP = 28;
const LEFT_MAX = 540;
const GROUP_PAD = 12;
const MAX_DRAWING_HEIGHT = 560;
const ROW_GAP = 8;
const SEGMENTED_CONTROL_WIDTH = 440;
const SEGMENTED_TEXT_MIN = 240;
const HEADING_HEIGHT = 26;
const LIST_ROW_MIN = 44;
const FOOTER_BUTTON_HEIGHT = 40;
const BOTTOM_PADDING = 28;
const SECTION_GAP = 18;
/** The scroll mask's edge would clip a border drawn exactly on it. */
const EDGE_INSET = 4;

/** Each drawing's width over its height, in the drawing module's own design units (`ui/controller-drawing.ts`). */
export const CONTROLLER_ASPECT: Readonly<Record<DrawingKind, number>> = {
  xbox: 454 / 453,
  playstation: 467 / 368,
  nintendo: 458 / 397,
  handheld: 760 / 470,
};

export interface ControlsGroupRowSpec {
  readonly id: "labels" | "nintendo" | "hints" | "hand";
  readonly kind: "segmented" | "toggle";
  readonly detail: string;
}

export interface ControlsListSectionSpec {
  readonly id: string;
  /** Null for a single untitled list headed elsewhere. */
  readonly title: string;
  readonly notes: readonly string[];
}

export interface ControlsLayoutInput {
  readonly tab: ControlsTab;
  readonly drawing: DrawingKind;
  readonly caption: string;
  readonly groupRows: readonly ControlsGroupRowSpec[];
  readonly sections: readonly ControlsListSectionSpec[];
  /** Footer button count: 2 on the controller tab (Remap, Reset), 1 on the keyboard tab. */
  readonly footerButtons: number;
}

export interface ControlsGroupRowLayout {
  readonly id: ControlsGroupRowSpec["id"];
  readonly kind: ControlsGroupRowSpec["kind"];
  readonly row: Rect;
  readonly control: Rect;
  /** A segmented control under its text instead of beside it. */
  readonly stacked: boolean;
  readonly slot: number;
}

export interface ControlsSectionLayout {
  readonly id: string;
  readonly heading: Rect;
  readonly rows: readonly Rect[];
  /** Where each row's action text starts, after its glyph column. */
  readonly textX: number;
  readonly slots: readonly number[];
}

export interface ControlsContentLayout {
  readonly twoColumns: boolean;
  readonly diagram: Rect | null;
  readonly caption: Rect | null;
  readonly group: Rect;
  readonly groupRows: readonly ControlsGroupRowLayout[];
  readonly sections: readonly ControlsSectionLayout[];
  readonly footer: readonly Rect[];
  readonly slots: readonly Rect[];
  readonly slotHeights: readonly number[];
  readonly totalHeight: number;
}

export interface ControlsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly close: Rect;
  readonly tabs: Rect;
  readonly tabCells: readonly [Rect, Rect];
  /** Right-aligned beside the rail, or under it on a narrow screen. */
  readonly status: Rect;
  readonly viewport: Rect;
  readonly content: ControlsContentLayout;
}

/** How many columns of a key chord or glyph the list reserves before the action text. */
const GLYPH_COLUMN: Readonly<Record<ControlsTab, number>> = { controller: 112, keyboard: 150 };

export function controlsLayout(bounds: Rect, input: ControlsLayoutInput): ControlsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, CONTROLS_HEADER_HEIGHT, 0, PANEL_MAX_WIDTH);
  const closeSize = 32;
  const close: Rect = {
    x: header.x + header.width - closeSize - 16,
    y: header.y + (header.height - closeSize) / 2,
    width: closeSize,
    height: closeSize,
  };
  const x = body.x + PAD_X;
  const width = Math.max(0, body.width - PAD_X * 2);
  const tabsWidth = Math.min(width, TAB_WIDTH * 2);
  const tabs: Rect = { x, y: body.y + 14, width: tabsWidth, height: hit.target };
  const tabCells: [Rect, Rect] = [
    { x: tabs.x, y: tabs.y, width: tabsWidth / 2, height: tabs.height },
    { x: tabs.x + tabsWidth / 2, y: tabs.y, width: tabsWidth / 2, height: tabs.height },
  ];
  const statusBeside = width >= tabsWidth + 380;
  const status: Rect = statusBeside
    ? { x: tabs.x + tabsWidth + 16, y: tabs.y, width: width - tabsWidth - 16, height: tabs.height }
    : { x: x, y: tabs.y + tabs.height + 6, width, height: 22 };
  const viewportTop = (statusBeside ? tabs.y + tabs.height : status.y + status.height) + 12;
  const viewport: Rect = {
    x,
    y: viewportTop,
    width,
    height: Math.max(0, body.y + body.height - viewportTop - 12),
  };
  const content = contentLayout(
    viewport.width - EDGE_INSET,
    formFactorFor(bounds.width, bounds.height) === "desktop",
    input,
  );
  return { panel, header, close, tabs, tabCells, status, viewport, content };
}

function contentLayout(width: number, onDesktop: boolean, input: ControlsLayoutInput): ControlsContentLayout {
  const twoColumns = input.tab === "controller" && width >= TWO_COLUMN_MIN_WIDTH;
  const leftWidth = twoColumns ? Math.min(LEFT_MAX, Math.floor(width * 0.46)) : 0;
  const rightX = twoColumns ? leftWidth + COLUMN_GAP : 0;
  const rightWidth = twoColumns ? width - rightX : width;
  const slots: Rect[] = [];

  let diagram: Rect | null = null;
  let caption: Rect | null = null;
  let leftBottom = 0;
  let y = 0;
  if (input.tab === "controller") {
    const drawWidth = twoColumns ? leftWidth : width;
    // The picture fills its card's width, up to a height that leaves the list in view.
    const w = Math.min(drawWidth, Math.round(MAX_DRAWING_HEIGHT * CONTROLLER_ASPECT[input.drawing]));
    const h = Math.round(w / CONTROLLER_ASPECT[input.drawing]);
    diagram = { x: Math.round((drawWidth - w) / 2), y: 0, width: w, height: h };
    const lines = estimateWrappedLines(input.caption, drawWidth, 5.8);
    caption = { x: 0, y: h + 10, width: drawWidth, height: lines * 16 + 4 };
    slots.push(diagram);
    leftBottom = caption.y + caption.height;
    if (!twoColumns) y = leftBottom + SECTION_GAP;
  }

  // The settings group: a parchment panel with its rows stacked inside.
  const groupX = rightX;
  const innerX = groupX + GROUP_PAD;
  const innerWidth = rightWidth - GROUP_PAD * 2;
  let gy = y + GROUP_PAD;
  const groupRows: ControlsGroupRowLayout[] = [];
  for (const spec of input.groupRows) {
    const slot = slots.length;
    if (spec.kind === "segmented") {
      const beside = innerWidth >= SEGMENTED_CONTROL_WIDTH + SEGMENTED_TEXT_MIN;
      const textHeight = toggleRowHeight(
        spec.detail,
        beside ? innerWidth - (SEGMENTED_CONTROL_WIDTH - 84) : innerWidth + 100,
        onDesktop,
      );
      const height = beside ? Math.max(textHeight, 48) : textHeight + 40;
      const cw = Math.min(SEGMENTED_CONTROL_WIDTH, innerWidth - 4);
      const control: Rect = beside
        ? { x: innerX + innerWidth - cw - 2, y: gy + (height - 32) / 2, width: cw, height: 32 }
        : { x: innerX + 2, y: gy + height - 36, width: cw, height: 32 };
      const row: Rect = { x: innerX, y: gy, width: innerWidth, height };
      groupRows.push({ id: spec.id, kind: "segmented", row, control, stacked: !beside, slot });
      slots.push(row);
      gy += height + ROW_GAP;
    } else {
      const height = toggleRowHeight(spec.detail, innerWidth, onDesktop);
      const row: Rect = { x: innerX, y: gy, width: innerWidth, height };
      const control: Rect = { x: innerX + innerWidth - 86, y: gy + (height - 32) / 2, width: 84, height: 32 };
      groupRows.push({ id: spec.id, kind: "toggle", row, control, stacked: false, slot });
      slots.push(row);
      gy += height + ROW_GAP;
    }
  }
  const group: Rect = { x: groupX, y, width: rightWidth, height: gy - ROW_GAP + GROUP_PAD - y };
  let cursor = y + group.height + SECTION_GAP;

  const glyphColumn = GLYPH_COLUMN[input.tab];
  const sections: ControlsSectionLayout[] = [];
  for (const spec of input.sections) {
    const heading: Rect = { x: rightX, y: cursor, width: rightWidth, height: HEADING_HEIGHT };
    slots.push(heading);
    cursor += HEADING_HEIGHT + 8;
    const rows: Rect[] = [];
    const rowSlots: number[] = [];
    for (const note of spec.notes) {
      const textWidth = rightWidth - glyphColumn - 8;
      const lines = estimateWrappedLines(note, textWidth, 5.4);
      const height = Math.max(LIST_ROW_MIN, 22 + lines * 14.5 + 8);
      const row: Rect = { x: rightX, y: cursor, width: rightWidth, height };
      rowSlots.push(slots.push(row) - 1);
      rows.push(row);
      cursor += height + 4;
    }
    sections.push({ id: spec.id, heading, rows, textX: rightX + glyphColumn, slots: rowSlots });
    cursor += SECTION_GAP - 4;
  }

  const footer: Rect[] = [];
  if (input.footerButtons > 0) {
    const stack = rightWidth < 420 && input.footerButtons > 1;
    const count = input.footerButtons;
    const bw = stack ? rightWidth : (rightWidth - 12 * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      footer.push({
        x: stack ? rightX : rightX + i * (bw + 12),
        y: cursor + (stack ? i * (FOOTER_BUTTON_HEIGHT + 8) : 0),
        width: bw,
        height: FOOTER_BUTTON_HEIGHT,
      });
    }
    slots.push(footer[0]!);
    cursor = footer[footer.length - 1]!.y + FOOTER_BUTTON_HEIGHT;
  }

  const totalHeight = Math.max(cursor, leftBottom) + BOTTOM_PADDING;
  // Slots may start at the same y (the drawing and the group): order by top so each spans to the next.
  const order = slots.map((rect, index) => ({ rect, index })).sort((a, b) => a.rect.y - b.rect.y || a.index - b.index);
  const slotHeights = Array.from({ length: slots.length }, () => 0);
  order.forEach(({ rect, index }, i) => {
    const next = order[i + 1];
    slotHeights[index] = (next ? next.rect.y : totalHeight) - (i === 0 ? 0 : rect.y);
  });
  return { twoColumns, diagram, caption, group, groupRows, sections, footer, slots, slotHeights, totalHeight };
}
