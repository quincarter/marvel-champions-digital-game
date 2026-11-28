import { html, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import type { LearnEventDetail } from "../shared/learn-events.types.js";
import { McWinActionsStyles } from "./mc-win-actions.styles.js";
import type { WinActionsProps } from "./mc-win-actions.types.js";

/**
 * # Win actions
 * The two ways on from How to win: a quiet "Tell me more" (the Rules reference at the glossary) and the red "Start the
 * fight", the screen's one forward action. Start waits (dimmed, no press) while the tutorial game is being made and then
 * says so in its words.
 *
 * @element mc-win-actions
 * @attr tell-label - Tell me more, already translated.
 * @attr start-label - Start the fight (or "Suiting up…" while it waits), already translated.
 * @attr starting - The tutorial game is being made.
 * @fires mc-learn - `{ type: "tell-more" }` and `{ type: "start" }`.
 */
export class McWinActions extends LearnElement implements WinActionsProps {
  static override styles = [McWinActionsStyles];

  static override properties: PropertyDeclarations = {
    tellLabel: { type: String, attribute: "tell-label" },
    startLabel: { type: String, attribute: "start-label" },
    starting: { type: Boolean, reflect: true },
  };

  declare tellLabel: string;
  declare startLabel: string;
  declare starting: boolean;

  constructor() {
    super();
    this.tellLabel = "";
    this.startLabel = "";
    this.starting = false;
  }

  #press(detail: LearnEventDetail): (event: Event) => void {
    return (event) => {
      event.stopPropagation();
      this.emit(detail);
    };
  }

  override render() {
    return html`<mc-button
        class="tell"
        kind="secondary"
        data-stop="tell-me-more"
        .label=${this.tellLabel}
        @mc-press=${this.#press({ type: "tell-more" })}
      ></mc-button>
      <mc-button
        class="start"
        kind="primary"
        display
        data-stop=${this.starting ? "" : "start-the-fight"}
        .label=${this.startLabel}
        ?disabled=${this.starting}
        @mc-press=${this.#press({ type: "start" })}
      ></mc-button>`;
  }
}
