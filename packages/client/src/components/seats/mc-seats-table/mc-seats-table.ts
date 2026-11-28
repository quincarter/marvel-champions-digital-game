import { McSeatsTable } from "./McSeatsTable.js";

if (!customElements.get("mc-seats-table")) {
  customElements.define("mc-seats-table", McSeatsTable);
}
