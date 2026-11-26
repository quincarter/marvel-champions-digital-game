/**
 * The room chat's message list as a layout model: every shown line stacked top to bottom in a scrolling region's own
 * space, and the region itself, which never extends past the rect the sheet gives it. A line taller than the region
 * (a long note, a narrow phone) is read by scrolling it, never drawn out of it over the field and buttons.
 */

/** How many of the newest lines the list keeps. */
export const CHAT_LINES_SHOWN = 60;
/** Space under each line. */
export const CHAT_LINE_GAP = 4;

export interface ChatLineIn {
  readonly text: string;
  readonly mine?: boolean;
  readonly name?: string;
}

export interface ChatLineOut {
  readonly text: string;
  readonly mine: boolean;
  /** Top of the line in the region's content space. */
  readonly y: number;
  readonly height: number;
}

export interface ChatListLayout {
  /** The region's height on the sheet: never more than the space the list was given. */
  readonly viewHeight: number;
  /** The content's height: all the lines, at least `viewHeight`. */
  readonly contentHeight: number;
  readonly lines: readonly ChatLineOut[];
}

/**
 * Lays out the newest lines (oldest first, so the newest ends at the bottom). `measure` is the wrapped height of a
 * line's text in its own type spec. `available` is the space between the title and the field.
 */
export function layoutChatList(
  chat: readonly ChatLineIn[],
  available: number,
  measure: (text: string, mine: boolean) => number,
): ChatListLayout {
  const lines: ChatLineOut[] = [];
  let y = 0;
  for (const line of chat.slice(-CHAT_LINES_SHOWN)) {
    const mine = line.mine === true;
    const who = mine ? "" : `${line.name ?? ""}: `;
    const text = `${who}${line.text}`;
    const height = measure(text, mine) + CHAT_LINE_GAP;
    lines.push({ text, mine, y, height });
    y += height;
  }
  const viewHeight = Math.max(0, available);
  return { viewHeight, contentHeight: Math.max(y, viewHeight), lines };
}
