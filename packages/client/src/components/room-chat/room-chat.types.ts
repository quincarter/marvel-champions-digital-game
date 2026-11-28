/**
 * The room chat's contract, shared by the lobby's Chat panel and the in-game chat dialog: the one `mc-room-chat` event
 * the compose row raises (composed, bubbling; it is in `GUARDED_EVENTS`). The text itself travels in the text field's own
 * `mc-input`, which the scene keeps as the draft.
 */
export const ROOM_CHAT_EVENT = "mc-room-chat";

/** Send was pressed (`button`), or Enter was typed in the field (`enter`: the field keeps the caret for the next line). */
export type RoomChatEvent = { readonly type: "send"; readonly via: "button" | "enter" };

export const roomChatEvent = (detail: RoomChatEvent): CustomEvent<RoomChatEvent> =>
  new CustomEvent(ROOM_CHAT_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-room-chat": CustomEvent<RoomChatEvent>;
  }
}
