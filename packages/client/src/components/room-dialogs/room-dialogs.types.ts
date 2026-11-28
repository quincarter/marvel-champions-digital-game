/**
 * The in-room dialogs' contract ("Ask for a change", "Give <hero> to...", the in-game chat): the models the scenes set and
 * the one `mc-room-dialog` event the dialogs raise (composed, bubbling; it is in `GUARDED_EVENTS`). A press is the pressed
 * control's own focus-stop key (`cancel`, `send`, `close`, `give:<participant>`), so the scene's focus route and a tap agree.
 * Words arrive translated.
 */
import type { ControlGlyphs, PopupButton } from "@mc/ui";
import type { ChatLinesModel } from "../room-chat/mc-chat-lines/mc-chat-lines.types.js";

export const ROOM_DIALOG_EVENT = "mc-room-dialog";

export type RoomDialogEvent = { readonly type: "press"; readonly key: string };

export const roomDialogEvent = (detail: RoomDialogEvent): CustomEvent<RoomDialogEvent> =>
  new CustomEvent(ROOM_DIALOG_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-room-dialog": CustomEvent<RoomDialogEvent>;
  }
}

/** "Ask for a change": a note to the host (at most 140 characters, the scene enforces it). */
export interface RoomAskModel {
  readonly heading: string;
  readonly body: string;
  readonly placeholder: string;
  /** The draft: the field adopts it only when it differs from what it holds. */
  readonly value: string;
  readonly cancel: PopupButton;
  readonly send: PopupButton;
  readonly glyphs: ControlGlyphs;
}

/** "Give <hero> to...": who in the room could take the seat. */
export interface RoomGiveModel {
  readonly heading: string;
  /** Said instead of the list when nobody is free. */
  readonly empty: string | null;
  readonly people: readonly { readonly id: string; readonly button: PopupButton }[];
  readonly cancel: PopupButton;
  readonly glyphs: ControlGlyphs;
}

/** The in-game chat: the newest lines, the compose row and Close. */
export interface RoomChatDialogModel {
  readonly heading: string;
  readonly lines: ChatLinesModel;
  readonly value: string;
  readonly placeholder: string;
  readonly sendLabel: string;
  readonly close: PopupButton;
  readonly glyphs: ControlGlyphs;
}
