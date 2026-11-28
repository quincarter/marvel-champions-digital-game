import { html, nothing, type PropertyDeclarations } from "lit";
import type { PauseChoiceInput, PauseTableInput } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseTableStyles } from "./mc-pause-table.styles.js";

/**
 * # Pause Table and Guide
 * The phone's inline settings: "Stop tutorial" and "Turn guide off" during a guided run, then Table (the card size and a
 * switch per quick setting), then Guide (the level as three tiles and a switch or door per row). Every row is a focus stop;
 * a press raises `mc-pause`. The page scrolls it.
 *
 * Focus stops: `guide-stop-tutorial`, `guide-turn-guide-off`, `table:card-size:<size>`, `table:<row>`,
 * `guide:guide-level:<level>`, `guide:<row>`.
 *
 * @element mc-pause-table
 * @prop input - The groups (`PauseTableInput`).
 * @fires mc-pause - `card-size`, `table`, `guide-level`, `guide`, or `{ type: "menu" }` for the guided run's buttons.
 */
export class McPauseTable extends PauseElement {
  static override styles = McPauseTableStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: PauseTableInput | null;

  constructor() {
    super();
    this.input = null;
  }

  #choice(choice: PauseChoiceInput) {
    return html`<mc-segments .options=${choice.options} look=${choice.look}></mc-segments>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const row = (r: PauseTableInput["rows"][number]) =>
      html`<mc-switch-row
        .stop=${r.stop}
        .titleText=${r.title}
        .detail=${r.detail}
        .state=${r.state}
        ?on=${r.on}
        ?unavailable=${r.unavailable}
        .action=${r.action}
      ></mc-switch-row>`;
    return html`${input.guideRun.map(
        (button) =>
          html`<div class="run">
            <mc-button
              kind="secondary"
              plain
              data-stop=${button.id}
              .label=${button.label}
              @mc-press=${() => this.say({ type: "menu", id: button.id })}
            ></mc-button>
          </div>`,
      )}
      <h3 class="heading">${input.tableHeading}</h3>
      <div class="choice">
        <div class="choice-title">${input.cardSize.title}</div>
        ${this.#choice(input.cardSize)}
      </div>
      ${input.rows.map(row)}
      <h3 class="heading">${input.guideHeading}</h3>
      ${input.level ? html`<div class="choice">${this.#choice(input.level)}</div>` : nothing}
      ${input.guideRows.map(row)}`;
  }
}
