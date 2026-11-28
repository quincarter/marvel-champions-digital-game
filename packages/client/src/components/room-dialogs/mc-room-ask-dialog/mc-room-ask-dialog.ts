import "@mc/ui";
import { McRoomAskDialog } from "./McRoomAskDialog.js";

if (!customElements.get("mc-room-ask-dialog")) {
  customElements.define("mc-room-ask-dialog", McRoomAskDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-room-ask-dialog": McRoomAskDialog;
  }
}

export { McRoomAskDialog };
