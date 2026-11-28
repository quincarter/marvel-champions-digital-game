import { McBriefingDecks } from "./McBriefingDecks.js";

if (!customElements.get("mc-briefing-decks")) {
  customElements.define("mc-briefing-decks", McBriefingDecks);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-decks": McBriefingDecks;
  }
}
