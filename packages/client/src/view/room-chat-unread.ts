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
