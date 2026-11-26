/**
 * In-game room chat's unread count (issue #881): how many lines from others the player has not seen since the chat
 * sheet was last open. Plain logic; the board shows it as words ("CHAT · 2") on the whose-turn row.
 */
import type { RoomChatLine } from "../live/room-state.js";

let readAt = 0;

/** Lines from other people newer than the last one read. */
export const unreadChatCount = (chat: readonly RoomChatLine[], since: number = readAt): number =>
  chat.filter((line) => !line.mine && line.at > since).length;

/** The chat sheet showed these lines: everything so far is read. */
export function markChatRead(chat: readonly RoomChatLine[]): void {
  readAt = chat.reduce((latest, line) => Math.max(latest, line.at), readAt);
}

/** A new room game starts with nothing read. */
export function resetChatRead(): void {
  readAt = 0;
}

/** The newest `count` lines, oldest first (what a sheet with room for `count` lines shows). */
export const lastChatLines = (chat: readonly RoomChatLine[], count: number): readonly RoomChatLine[] =>
  count <= 0 ? [] : chat.slice(-count);

/**
 * What the open chat sheet last drew: enough to tell whether the room's chat has changed since. The room keeps only the
 * newest `MAX_CHAT_KEPT` lines, so once it is full a new line drops the oldest and the length stays put: the first and
 * last lines count too.
 */
export interface ChatMark {
  readonly length: number;
  readonly first: string;
  readonly last: string;
}

const lineKey = (line: RoomChatLine | undefined): string =>
  line ? `${line.at}|${line.mine ? 1 : 0}|${line.name ?? ""}|${line.text}` : "";

/** The mark of these lines, to hold and compare with `chatChanged`. */
export const chatMark = (chat: readonly RoomChatLine[]): ChatMark => ({
  length: chat.length,
  first: lineKey(chat[0]),
  last: lineKey(chat[chat.length - 1]),
});

/** Whether `chat` differs from what `drawn` marked (null: nothing drawn yet). */
export const chatChanged = (drawn: ChatMark | null, chat: readonly RoomChatLine[]): boolean => {
  if (!drawn) return true;
  const now = chatMark(chat);
  return now.length !== drawn.length || now.first !== drawn.first || now.last !== drawn.last;
};
