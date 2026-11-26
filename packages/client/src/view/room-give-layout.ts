/**
 * "Give <hero> to..." as a layout model: the box never extends past the screen, the recipients sit in a scrolling
 * region (25 people fit no phone), and Cancel is a fixed footer outside it, so nothing is drawn over the list.
 */
import type { Rect } from "./layout.js";

export interface RoomGiveLayoutIn {
  readonly width: number;
  readonly height: number;
  readonly titleHeight: number;
  /** The "nobody is free" line's height, when there are no recipients. */
  readonly emptyHeight: number | null;
  readonly recipients: number;
  /** A recipient button's height, and Cancel's. */
  readonly target: number;
}

export interface RoomGiveLayout {
  readonly box: Rect;
  readonly inner: number;
  /** Where the list shows (a scrolling region when `contentHeight` is more than its height). */
  readonly list: Rect;
  readonly contentHeight: number;
  /** Top of each recipient in the list's content space. */
  readonly rowTops: readonly number[];
  readonly cancel: Rect;
}

export const GIVE_ROW_GAP = 6;

export function layoutRoomGive(i: RoomGiveLayoutIn): RoomGiveLayout {
  const boxWidth = Math.min(420, i.width - 32);
  const inner = boxWidth - 40;
  const rowTops = Array.from({ length: i.recipients }, (_, n) => n * (i.target + GIVE_ROW_GAP));
  const contentHeight = i.recipients === 0 ? (i.emptyHeight ?? 0) : i.recipients * (i.target + GIVE_ROW_GAP);
  const head = 20 + i.titleHeight + 12;
  const foot = 10 + i.target + 20;
  const natural = head + contentHeight + foot;
  const boxHeight = Math.min(natural, Math.max(0, i.height - 24));
  const box: Rect = {
    x: (i.width - boxWidth) / 2,
    y: Math.max(12, (i.height - boxHeight) / 3),
    width: boxWidth,
    height: boxHeight,
  };
  const viewHeight = Math.max(0, boxHeight - head - foot);
  return {
    box,
    inner,
    list: { x: box.x + 20, y: box.y + head, width: inner, height: Math.min(contentHeight, viewHeight) },
    contentHeight,
    rowTops,
    cancel: { x: box.x + 20, y: box.y + box.height - 20 - i.target, width: inner, height: i.target },
  };
}
