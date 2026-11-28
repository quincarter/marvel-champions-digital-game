export type { RoomChatDialogModel, RoomDialogEvent } from "../room-dialogs.types.js";
export type { RoomChatEvent } from "../../room-chat/room-chat.types.js";

/** The longest chat line (the scene enforces it through the field's `restoreValue`). */
export const MAX_CHAT_LINE = 280;
