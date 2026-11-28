import { McLobbyEpicTable } from "./McLobbyEpicTable.js";

if (!customElements.get("mc-lobby-epic-table")) {
  customElements.define("mc-lobby-epic-table", McLobbyEpicTable);
}
