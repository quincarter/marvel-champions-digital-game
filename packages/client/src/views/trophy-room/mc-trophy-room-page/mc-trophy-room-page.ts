import { McTrophyRoomPage } from "./McTrophyRoomPage.js";

if (!customElements.get("mc-trophy-room-page")) {
  customElements.define("mc-trophy-room-page", McTrophyRoomPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-room-page": McTrophyRoomPage;
  }
}
