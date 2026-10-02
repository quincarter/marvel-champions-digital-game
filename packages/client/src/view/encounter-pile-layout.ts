import type { Rect } from "./layout.js";

/** Below this box height a pile can't stack a name chip over a count chip without them overprinting each other. */
export const PILE_STACK_MIN_HEIGHT = 64;

export interface PileChips {
  /** The ink strip the pile's name sits on (over art, so it stays readable). */
  readonly name: Rect;
  /** The ink strip the count sits on. In `row` mode it shares the strip's row with `name`, to its right. */
  readonly count: Rect;
  readonly mode: "stacked" | "row";
}

/**
 * Where an encounter pile's name and count go. A tall box stacks the name chip at the top and the count at the
 * bottom; a short one (the encounter column splits its height among every pile) puts both on one strip along the
 * bottom, name left and count right, so neither is drawn over the other or left floating on bare art.
 */
export function pileChipsOf(box: Rect): PileChips {
  if (box.height >= PILE_STACK_MIN_HEIGHT) {
    return {
      mode: "stacked",
      name: { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: 18 },
      count: { x: box.x + 4, y: box.y + box.height - 26, width: box.width - 8, height: 22 },
    };
  }
  const height = Math.min(22, Math.max(14, box.height - 6));
  const y = box.y + box.height - 3 - height;
  const countWidth = Math.min(32, Math.round((box.width - 6) * 0.22));
  return {
    mode: "row",
    name: { x: box.x + 3, y, width: box.width - 6 - countWidth, height },
    count: { x: box.x + box.width - 3 - countWidth, y, width: countWidth, height },
  };
}
