import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { UNLOCKS_EVENT, type UnlocksEventDetail, type UnlocksListRow } from "../unlocks.types.js";
import { McUnlocksListStyles } from "./mc-unlocks-list.styles.js";

/**
 * # Unlocks list
 * The scrolling list of every campaign and wave (with what opens it) and every hero in it: a section title, a wave line
 * with its status, or an `mc-switch-row` per campaign, scenario or hero. A campaign's or hero's switch is a focus stop
 * `row:<id>`; a wave and a scenario are in view only. Native scrolling.
 *
 * @element mc-unlocks-list
 * @prop rows - `UnlocksListRow[]`.
 * @fires mc-unlocks - `{ type: "row", id }`.
 */
export class McUnlocksList extends LitElement {
  static override styles = [McUnlocksListStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
  };

  declare rows: readonly UnlocksListRow[];

  constructor() {
    super();
    this.rows = [];
    new FeatureRelay<UnlocksEventDetail>(this, UNLOCKS_EVENT);
  }

  /** The scrolling element (the stick and the Page keys move it). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The element drawn for a row, to bring it into view. */
  rowElement(id: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-row="${CSS.escape(id)}"]`);
  }

  #row(row: UnlocksListRow) {
    if (row.kind === "section") return html`<h3 class="section" data-row=${row.id}>${row.title}</h3>`;
    if (row.kind === "wave")
      return html`<div class="wave" data-row=${row.id} ?data-open=${row.open}>
        <span class="wave-title">${row.title}</span>
        <span class="wave-status">${row.status}</span>
      </div>`;
    return html`<mc-switch-row
      data-row=${row.id}
      .stop=${row.stop ? `row:${row.id}` : ""}
      .titleText=${row.title}
      .detail=${row.detail}
      .state=${row.state}
      ?on=${row.on}
      ?unavailable=${row.unavailable}
      .action=${row.stop ? { type: "row", id: row.id } : null}
    ></mc-switch-row>`;
  }

  override render() {
    return this.rows.length === 0
      ? nothing
      : html`<div class="scroller" data-key="list">${this.rows.map((row) => this.#row(row))}</div>`;
  }
}
