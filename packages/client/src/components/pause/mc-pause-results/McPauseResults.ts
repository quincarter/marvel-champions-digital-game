import { html, nothing, type PropertyDeclarations } from "lit";
import "../mc-pause-link-row/mc-pause-link-row.js";
import type { PauseResultRow, PauseResultsInput } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseResultsStyles } from "./mc-pause-results.styles.js";

/**
 * # Pause search results
 * What the search found, in groups (Settings, Rules, Reference, More): a Settings switch or choice that can be changed in
 * place, and rows that open their page with what matched marked. While the worker has not answered, or when nothing
 * matches, a line says so above the groups. The page scrolls it, on the ink ground the pane turns while searching.
 *
 * Focus stops: `result:<id>`, `result:<id>:<value>` for a choice's cells.
 *
 * @element mc-pause-results
 * @prop input - The answer (`PauseResultsInput`).
 * @fires mc-pause - `result` or `setting`.
 */
export class McPauseResults extends PauseElement {
  static override styles = McPauseResultsStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: PauseResultsInput | null;

  constructor() {
    super();
    this.input = null;
  }

  #row(result: PauseResultRow) {
    switch (result.kind) {
      case "switch": {
        const r = result.row;
        return html`<mc-switch-row
          .stop=${r.stop}
          .titleText=${r.title}
          .detail=${r.detail}
          .state=${r.state}
          ?on=${r.on}
          ?unavailable=${r.unavailable}
          .action=${r.action}
        ></mc-switch-row>`;
      }
      case "choice":
        return html`<div class="choice">
          <div class="choice-title">${result.row.title}</div>
          ${result.row.detail ? html`<div class="choice-detail">${result.row.detail}</div>` : nothing}
          <mc-segments .options=${result.row.options} look=${result.row.look}></mc-segments>
        </div>`;
      case "link":
        return html`<mc-pause-link-row .row=${result.row}></mc-pause-link-row>`;
    }
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`${input.note ? html`<p class="note">${input.note}</p>` : nothing}
    ${input.groups.map(
      (group) =>
        html`<section class="group">
          <h3 class="heading">${group.title}</h3>
          ${group.rows.map((row) => this.#row(row))}
        </section>`,
    )}`;
  }
}
