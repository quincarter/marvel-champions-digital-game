/**
 * Where the "Remove how many X counters?" bar (`scenes/board/cost-choice-bar.ts`) puts its question, its count buttons
 * and Cancel, in the bar's own coordinates. Plain numbers so the no-overlap promise is unit tested at every width.
 *
 * Wide: the question on the left, one row of counts, Cancel on the right. When the counts would not fit beside the
 * question at their minimum width (We Are Groot's four growth counters on a 320 px phone, issue #856 review), the
 * question moves to its own line above them, and counts that still do not fit in one row wrap onto more rows; the bar
 * grows to hold them. A count is never narrower than `MIN_COUNT_WIDTH` and never reaches into Cancel.
 */

export const MIN_COUNT_WIDTH = 40;
export const MAX_COUNT_WIDTH = 56;
export const COUNT_GAP = 6;
/** The question's own line, when it sits above the counts. */
export const QUESTION_ROW = 30;

export interface BarBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CostCountsLayout {
  /** The bar's whole height: `rowHeight` per row of counts, plus the question's line when it is stacked. */
  readonly height: number;
  /** The question: beside the counts (vertically centred on the first row) or on its own line above them. */
  readonly question: BarBox & { readonly stacked: boolean };
  readonly counts: readonly BarBox[];
  readonly cancel: BarBox;
}

const cancelWidthOf = (barWidth: number): number => Math.max(64, Math.min(110, barWidth * 0.12));

/** `count` buttons on a bar `barWidth` wide whose single row is `rowHeight` tall. */
export function costCountsLayout(barWidth: number, rowHeight: number, count: number): CostCountsLayout {
  const n = Math.max(1, count);
  const cancelWidth = cancelWidthOf(barWidth);
  const cancelX = barWidth - cancelWidth - 10;
  const need = (columns: number, width: number): number => columns * width + COUNT_GAP * (columns - 1);

  // Beside the counts the question takes up to 380 px (42% of the bar), giving way to the counts down to a branch
  // title's 220 px / 28%; only when the counts still do not fit at that does it stack on its own line.
  const leastTitle = Math.min(220, barWidth * 0.28);
  const mostTitle = Math.max(leastTitle, Math.min(380, barWidth * 0.42));
  const besideTitle = Math.min(mostTitle, cancelX - COUNT_GAP - need(n, MIN_COUNT_WIDTH));
  const fitsBeside = besideTitle >= leastTitle;
  const wideTitle = fitsBeside ? besideTitle : 0;

  const left = fitsBeside ? wideTitle : 10;
  const room = cancelX - COUNT_GAP - left;
  const perRow = Math.max(1, Math.min(n, Math.floor((room + COUNT_GAP) / (MIN_COUNT_WIDTH + COUNT_GAP))));
  const rows = Math.ceil(n / perRow);
  const width = Math.max(MIN_COUNT_WIDTH, Math.min(MAX_COUNT_WIDTH, (room - COUNT_GAP * (perRow - 1)) / perRow));
  const top = fitsBeside ? 0 : QUESTION_ROW;
  const counts = Array.from({ length: n }, (_, i): BarBox => {
    const row = Math.floor(i / perRow);
    const column = i % perRow;
    return { x: left + column * (width + COUNT_GAP), y: top + row * rowHeight + 4, width, height: rowHeight - 8 };
  });
  const height = top + rows * rowHeight;
  return {
    height,
    question: fitsBeside
      ? { x: 12, y: 0, width: wideTitle - 16, height: rowHeight, stacked: false }
      : { x: 12, y: 4, width: barWidth - 24, height: QUESTION_ROW - 4, stacked: true },
    counts,
    cancel: { x: cancelX, y: top + 4, width: cancelWidth, height: rowHeight - 8 },
  };
}
