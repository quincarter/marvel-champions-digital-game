import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { saveDataEvent, type SaveDataActionsInput } from "../save-data.types.js";
import { McSaveDataActionsStyles } from "./mc-save-data-actions.styles.js";

/**
 * # Save data actions
 * The six ways to move or share your data (Export, Import, Send, Receive, Sync, Share results): each a title (device
 * sync carries a BETA stamp), a line of detail and a button, the stop `row:<id>`. They sit in a column on a phone and two
 * by two where the panel is wide; the page scrolls them. While a file is in flight every button is dimmed and inert.
 *
 * @element mc-save-data-actions
 * @prop input - `SaveDataActionsInput`.
 * @fires mc-save-data - `{ type: "action", id }`.
 */
export class McSaveDataActions extends LitElement {
  static override styles = [McSaveDataActionsStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: SaveDataActionsInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`${input.rows.map(
      (row) =>
        html`<section class="row">
          <h3 class="title">
            <span>${row.title}</span>${row.beta ? html`<mc-stamp tone="red" label="BETA"></mc-stamp>` : nothing}
          </h3>
          <p class="detail">${row.detail}</p>
          <mc-hint-button
            class="button"
            kind="secondary"
            data-stop=${`row:${row.id}`}
            .label=${row.label}
            ?disabled=${input.disabled}
            @mc-press=${(event: Event) => {
              event.stopPropagation();
              this.dispatchEvent(saveDataEvent({ type: "action", id: row.id }));
            }}
          ></mc-hint-button>
        </section>`,
    )}`;
  }
}
