/**
 * Where a row of aspect chips breaks when it is wider than the room it has: onto a second line, never off the edge.
 * An aspect chip is a colored plate with the aspect's name on it (never color alone), and an identity can carry four
 * (Adam Warlock), which at a deck row's width is more than one line holds. Pure, so the break is tested without a
 * canvas; the scene measures each chip's own width and draws one line per entry returned here.
 */

/** The chips (by index) that share each line, left to right, packed greedily within `maxWidth`. A chip wider than a line sits alone on its own. */
export function packChipRows(widths: readonly number[], gap: number, maxWidth: number): readonly (readonly number[])[] {
  const rows: number[][] = [];
  let used = 0;
  widths.forEach((width, index) => {
    const row = rows.at(-1);
    if (row && used + gap + width <= maxWidth) {
      row.push(index);
      used += gap + width;
    } else {
      rows.push([index]);
      used = width;
    }
  });
  return rows;
}

/** The widest line of a packing, for the room the next element beside it can have. */
export function widestRow(widths: readonly number[], rows: readonly (readonly number[])[], gap: number): number {
  return rows.reduce(
    (widest, row) => Math.max(widest, row.reduce((sum, i) => sum + widths[i]!, 0) + gap * Math.max(0, row.length - 1)),
    0,
  );
}
