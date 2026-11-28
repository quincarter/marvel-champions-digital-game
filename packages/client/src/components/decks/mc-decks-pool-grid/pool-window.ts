/** Which rows of a windowed grid are drawn: those in view and one above and below, so a scroll never shows a gap. */
export interface GridWindowInput {
  readonly count: number;
  readonly columns: number;
  /** A row's height including the gap under it. */
  readonly rowHeight: number;
  readonly top: number;
  readonly viewHeight: number;
}

export interface GridWindow {
  /** Every row's height together (the spacer). */
  readonly totalHeight: number;
  /** Where the first drawn row starts. */
  readonly offset: number;
  readonly firstIndex: number;
  /** One past the last drawn card. */
  readonly endIndex: number;
}

export function gridWindow(input: GridWindowInput): GridWindow {
  const { count, columns, rowHeight, top, viewHeight } = input;
  const rows = Math.max(1, Math.ceil(count / columns));
  const first = Math.max(0, Math.floor(top / rowHeight) - 1);
  const last = Math.min(rows, Math.ceil((top + Math.max(viewHeight, rowHeight)) / rowHeight) + 1);
  return {
    totalHeight: rows * rowHeight,
    offset: first * rowHeight,
    firstIndex: first * columns,
    endIndex: Math.min(count, last * columns),
  };
}
