/**
 * The "only one option" notice as a layout model: the box never extends past the screen, the text and option rows sit
 * in a scrolling region, and the buttons are a fixed footer outside it, so a long translated reason or a short
 * landscape phone scrolls the text and never pushes OK off the screen.
 *
 * Also the notice's button identity: a button's DOM key carries which notice it belongs to, so a press begun on one
 * notice cannot be finished on the next (the same element reused would run the new notice's action).
 */
import type { Rect } from "./layout.js";

export interface NoticeLayoutIn {
  readonly width: number;
  readonly height: number;
  readonly titleHeight: number;
  readonly leadHeight: number;
  /** Each option row's text height. */
  readonly rowTextHeights: readonly number[];
  /** An action stacked above OK. */
  readonly stacked: boolean;
  readonly buttonHeight: number;
}

export interface NoticeLayout {
  readonly box: Rect;
  readonly textWidth: number;
  readonly scroll: Rect;
  readonly contentHeight: number;
  /** In the scroll's content space. */
  readonly titleY: number;
  readonly leadY: number;
  readonly rowFrames: readonly { readonly y: number; readonly height: number }[];
  /** Top of the button row (OK, or OK and the side button); the stacked side button sits above it. */
  readonly buttonY: number;
}

export const NOTICE_ROW_GAP = 10;
const TOP = 14;
const PAD = 6;

export function layoutNotice(i: NoticeLayoutIn): NoticeLayout {
  const boxWidth = Math.min(560, i.width - 32);
  const textWidth = boxWidth - 40;
  let y = PAD;
  const titleY = y;
  y += i.titleHeight + 8;
  const leadY = y;
  y += i.leadHeight + 14;
  const rowFrames = i.rowTextHeights.map((h) => {
    const frame = { y, height: h + 16 };
    y += frame.height + NOTICE_ROW_GAP;
    return frame;
  });
  const contentHeight = y;
  const footer = 10 + i.buttonHeight + (i.stacked ? i.buttonHeight + 10 : 0) + 20;
  const natural = TOP + contentHeight + footer;
  const boxHeight = Math.min(natural, Math.max(0, i.height - 32));
  const box: Rect = {
    x: (i.width - boxWidth) / 2,
    y: Math.max(16, (i.height - boxHeight) / 2),
    width: boxWidth,
    height: boxHeight,
  };
  const viewHeight = Math.max(0, boxHeight - TOP - footer);
  return {
    box,
    textWidth,
    scroll: { x: box.x + 20, y: box.y + TOP, width: textWidth, height: Math.min(contentHeight, viewHeight) },
    contentHeight,
    titleY,
    leadY,
    rowFrames,
    buttonY: box.y + box.height - 20 - i.buttonHeight,
  };
}

export type NoticeButton = "ok" | "never";

/** A notice button's DOM key: the button, the notice's identity and what the button does there. */
export function noticeButtonKey(button: NoticeButton, noticeId: number, action: boolean): string {
  return `${button}:${noticeId}:${action ? "action" : button === "never" ? "optout" : "dismiss"}`;
}

/** The button a key names, when it belongs to notice `current`; null for a stale key (another notice's button). */
export function noticeButtonOf(key: string, current: number): NoticeButton | null {
  const [button, id] = key.split(":");
  if ((button !== "ok" && button !== "never") || Number(id) !== current) return null;
  return button;
}

/**
 * The DOM key of a notice's scrolling text: one per notice, so the next queued notice opens at its top (the sheet keeps a
 * keyed scroller's position across redraws, which is wanted for the same notice, on a resize or a glyph change).
 */
export const noticeTextKey = (noticeId: number): string => `notice-text:${noticeId}`;
