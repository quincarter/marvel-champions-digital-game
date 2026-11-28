export type { RoomChatEvent } from "../room-chat.types.js";

/** The compose row's properties (all words already translated). */
export interface McChatComposeProps {
  value: string;
  placeholder: string;
  sendLabel: string;
  disabled: boolean;
  fieldStop: string;
  sendStop: string;
}
