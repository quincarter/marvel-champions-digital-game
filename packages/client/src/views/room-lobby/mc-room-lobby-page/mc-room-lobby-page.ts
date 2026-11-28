import "../../../components/room-lobby/room-lobby-sections.js";
import { McRoomLobbyPage } from "./McRoomLobbyPage.js";

if (!customElements.get("mc-room-lobby-page")) {
  customElements.define("mc-room-lobby-page", McRoomLobbyPage);
}
