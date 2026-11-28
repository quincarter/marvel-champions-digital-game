import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { saveDataEvent, type SaveDataStatusInput } from "../save-data.types.js";
import { McSaveDataStatusStyles } from "./mc-save-data-status.styles.js";

/**
 * # Save data status
 * The line under the step: what just happened or that a file is in flight, a polite live region. An error says so in its
 * words (the text arrives already prefixed with "Problem:") and in a caution mark, never in colour alone. When the
 * service is unavailable an Export button (stop `status-export`) offers the offline way to move a save.
 *
 * @element mc-save-data-status
 * @prop input - `SaveDataStatusInput`.
 * @fires mc-save-data - `{ type: "status-export" }`.
 */
export class McSaveDataStatus extends LitElement {
  static override styles = [McSaveDataStatusStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: SaveDataStatusInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<p class="line" data-tone=${input.tone} role="status">
        ${input.tone === "error" ? html`<span class="mark" aria-hidden="true">!</span>` : nothing}<span
          >${input.text}</span
        >
      </p>
      ${
        input.exportLabel
          ? html`<mc-hint-button
              kind="secondary"
              data-stop="status-export"
              .label=${input.exportLabel}
              @mc-press=${(event: Event) => {
                event.stopPropagation();
                this.dispatchEvent(saveDataEvent({ type: "status-export" }));
              }}
            ></mc-hint-button>`
          : nothing
      }`;
  }
}
