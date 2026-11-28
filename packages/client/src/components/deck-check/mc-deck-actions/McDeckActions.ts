import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { DeckCheckElement } from "../shared/DeckCheckElement.js";
import { McDeckActionsStyles } from "./mc-deck-actions.styles.js";
import type { McDeckActionsProps } from "./mc-deck-actions.types.js";

/**
 * # Deck actions
 * Edit deck (quiet) and Start game (the screen's one red action), at the foot of the wide panel or in the narrow footer.
 * Start game is dimmed, with its reason, when there is no setup flow to continue into.
 *
 * @element mc-deck-actions
 * @fires mc-deck-check - `{ type: "edit" }` and `{ type: "start" }`.
 */
export class McDeckActions extends DeckCheckElement implements McDeckActionsProps {
  static override styles = [ThemeStyles, McDeckActionsStyles];

  static override properties: PropertyDeclarations = {
    layout: { type: String, reflect: true },
    editLabel: { type: String, attribute: "edit-label" },
    startLabel: { type: String, attribute: "start-label" },
    startUnavailable: { type: String, attribute: "start-unavailable" },
  };

  declare layout: "stack" | "row";
  declare editLabel: string;
  declare startLabel: string;
  declare startUnavailable: string;

  constructor() {
    super();
    this.layout = "stack";
    this.editLabel = "";
    this.startLabel = "";
    this.startUnavailable = "";
  }

  override render() {
    return html`<mc-button
        class="edit"
        kind="onInk"
        data-stop="edit-deck"
        data-key="edit-deck"
        .label=${this.editLabel}
        @mc-press=${() => this.emit({ type: "edit" })}
      ></mc-button>
      <mc-button
        class="start"
        kind="primary"
        display
        data-stop="start"
        data-key="start"
        .label=${this.startLabel}
        ?disabled=${this.startUnavailable !== ""}
        .reason=${this.startUnavailable}
        @mc-press=${() => this.emit({ type: "start" })}
      ></mc-button>`;
  }
}
