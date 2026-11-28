import "@mc/ui";
import { McRoomGiveDialog } from "./McRoomGiveDialog.js";

if (!customElements.get("mc-room-give-dialog")) {
  customElements.define("mc-room-give-dialog", McRoomGiveDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-room-give-dialog": McRoomGiveDialog;
  }
}

export { McRoomGiveDialog };
