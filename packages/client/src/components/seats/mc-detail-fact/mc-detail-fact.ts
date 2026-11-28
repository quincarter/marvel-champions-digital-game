import { McDetailFact } from "./McDetailFact.js";

if (!customElements.get("mc-detail-fact")) {
  customElements.define("mc-detail-fact", McDetailFact);
}
