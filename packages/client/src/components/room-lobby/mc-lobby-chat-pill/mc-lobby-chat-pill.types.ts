import type { LobbyChatPillModel } from "../room-lobby.types.js";

export type { LobbyChatPillModel };

/** The pill's properties. */
export interface McLobbyChatPillProps {
  model: LobbyChatPillModel | null;
}

/** The badge's words: the count, "9+" past nine. */
export function unreadLabel(unread: number): string {
  return unread > 9 ? "9+" : String(unread);
}
