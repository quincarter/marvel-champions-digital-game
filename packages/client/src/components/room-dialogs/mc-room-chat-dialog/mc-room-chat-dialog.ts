import "@mc/ui";
import { McRoomChatDialog } from "./McRoomChatDialog.js";

if (!customElements.get("mc-room-chat-dialog")) {
  customElements.define("mc-room-chat-dialog", McRoomChatDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-room-chat-dialog": McRoomChatDialog;
  }
}

export { McRoomChatDialog };
