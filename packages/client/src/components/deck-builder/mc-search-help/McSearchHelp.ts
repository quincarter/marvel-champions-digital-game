import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McDialog } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McSearchHelpStyles } from "./mc-search-help.styles.js";
import type { SearchHelpModel, SearchHelpRowModel } from "./mc-search-help.types.js";

/**
 * # Search help
 * The deck builder's search cheat sheet (issue #531) as a dialog: every search term `pool-query.ts` reads, how they combine,
 * and ready examples. Each example has Use, which puts it in the search box and closes the sheet, and Copy, since a canvas
 * cannot be selected. The list scrolls natively and every button is a tap, so a swipe that lifts over Use or Copy presses
 * nothing. A tap on the scrim, or Back, closes it.
 *
 * Focus stops: `use:<row>`, `copy:<row>`, `back`.
 *
 * @element mc-search-help
 * @prop model - The sheet (`SearchHelpModel`).
 * @fires mc-deck-builder - `help-use`, `help-copy`, `sheet-close`.
 * @fires mc-dialog-dismiss - A tap on the scrim (bubbles from the dialog).
 */
export class McSearchHelp extends BuilderElement {
  static override styles = [ThemeStyles, McSearchHelpStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SearchHelpModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The list's scroller, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McDialog>("mc-dialog")?.scroller ?? null;
  }

  #row(model: SearchHelpModel, row: SearchHelpRowModel, index: number) {
    if (row.kind === "heading") return html`<h3>${row.text}</h3>`;
    if (row.kind === "note") return html`<p>${row.text}</p>`;
    const copied = model.copied?.index === index ? model.copied : null;
    return html`<div class="row">
      <div class="words">
        <div class="query">${row.query}</div>
        <div class="meaning">${row.meaning}</div>
      </div>
      <mc-button
        class="use"
        kind="secondary"
        data-stop=${`use:${index}`}
        .label=${model.useLabel}
        @mc-press=${this.send({ type: "help-use", query: row.query })}
      ></mc-button>
      <mc-button
        class="copy"
        kind="secondary"
        data-stop=${`copy:${index}`}
        .label=${copied ? (copied.ok ? model.copiedLabel : model.failedLabel) : model.copyLabel}
        ?selected=${copied?.ok ?? false}
        @mc-press=${this.send({ type: "help-copy", index, query: row.query })}
      ></mc-button>
    </div>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<mc-dialog tall .heading=${model.title} .width=${720}>
      ${model.rows.map((row, index) => this.#row(model, row, index))}
      <mc-button
        slot="footer"
        class="back"
        kind="secondary"
        data-stop="back"
        .label=${model.backLabel}
        @mc-press=${this.send({ type: "sheet-close" })}
      ></mc-button>
    </mc-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-search-help": McSearchHelp;
  }
}
