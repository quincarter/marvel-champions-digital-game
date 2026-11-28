import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McDialog } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McPoolPickStyles } from "./mc-pool-pick.styles.js";
import type { PoolPickModel } from "./mc-pool-pick.types.js";

/**
 * # Pool pick
 * The deck builder's pack and wave picker (issue #977, benpap24) as a dialog: every pack (under its wave) or every wave is a
 * row that toggles, so several are chosen at once instead of stepping through them one at a time; a chosen row reads with a
 * tick. "All" clears the choice. Each press applies at once (the pool behind updates); Done, B, Escape or a tap on the scrim
 * closes it.
 *
 * Focus stops: `pick:all`, `pick:<id>`, `done`.
 *
 * @element mc-pool-pick
 * @prop model - The picker (`PoolPickModel`).
 * @fires mc-deck-builder - `pick-all`, `pick-toggle`, `sheet-close`.
 * @fires mc-dialog-dismiss - A tap on the scrim (bubbles from the dialog).
 */
export class McPoolPick extends BuilderElement {
  static override styles = [ThemeStyles, McPoolPickStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: PoolPickModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The list's scroller, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McDialog>("mc-dialog")?.scroller ?? null;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<mc-dialog .heading=${model.title} .width=${520}>
      <p class="subtitle" slot="intro">${model.subtitle}</p>
      <mc-button
        class="all"
        kind="secondary"
        data-stop="pick:all"
        .label=${`${model.allChosen ? "✓ " : ""}${model.allLabel}`}
        ?selected=${model.allChosen}
        @mc-press=${this.send({ type: "pick-all" })}
      ></mc-button>
      ${model.rows.map((row) =>
        row.kind === "heading"
          ? html`<div class="head">${row.text}</div>`
          : html`<mc-button
              class="choice"
              kind="secondary"
              data-stop=${`pick:${row.id}`}
              .label=${`${row.selected ? "✓ " : ""}${row.name}`}
              ?selected=${row.selected}
              @mc-press=${this.send({ type: "pick-toggle", id: row.id })}
            ></mc-button>`,
      )}
      <mc-button
        slot="footer"
        class="done"
        kind="primary"
        data-stop="done"
        .label=${model.doneLabel}
        @mc-press=${this.send({ type: "sheet-close" })}
      ></mc-button>
    </mc-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pool-pick": McPoolPick;
  }
}
