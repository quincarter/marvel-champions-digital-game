import { html, nothing, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import { McLinkListStyles } from "./mc-link-list.styles.js";
import type { LinkListProps, LinkListRow } from "./mc-link-list.types.js";

/**
 * # Link list
 * A labelled run of rows that lead somewhere (`mc-link-row`): REFERENCE (one row, Rules & glossary) and NEW IN EACH BOX (a
 * row per box page the player has unlocked) on the How to play hub. Each row names its own focus stop and the `mc-learn`
 * event a press raises. `columns` lays the rows out in that many equal columns.
 *
 * @element mc-link-list
 * @attr heading - The label, already translated.
 * @prop rows - The rows (`LinkListRow`).
 * @attr columns - How many equal columns the rows fill (1).
 * @fires mc-learn - Each row's own `LearnEventDetail`.
 */
export class McLinkList extends LearnElement implements LinkListProps {
  static override styles = [McLinkListStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    rows: { attribute: false },
    columns: { type: Number, reflect: true },
  };

  declare heading: string;
  declare rows: readonly LinkListRow[];
  declare columns: number;

  constructor() {
    super();
    this.heading = "";
    this.rows = [];
    this.columns = 1;
  }

  override render() {
    if (this.rows.length === 0) return nothing;
    return html`<div class="label">${this.heading}</div>
      <div class="rows">
        ${this.rows.map(
          (row) =>
            html`<mc-link-row
              heading=${row.heading}
              detail=${row.detail}
              .stop=${row.stop}
              .action=${row.action}
            ></mc-link-row>`,
        )}
      </div>`;
  }
}
