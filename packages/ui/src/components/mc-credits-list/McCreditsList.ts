import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McCreditsListStyles } from "./mc-credits-list.styles.js";

/** One row of the Art & Credits list, already worded and translated by the client (`view/credits-model.ts`). */
export type CreditsListRow =
  | { readonly kind: "notice"; readonly text: string }
  | { readonly kind: "section"; readonly title: string; readonly count: string }
  | {
      readonly kind: "entry";
      readonly title: string;
      /** The lines under the title, in order: "body" for the credit itself, "small" for the rest. */
      readonly lines: readonly { readonly text: string; readonly tone: "body" | "small" }[];
    };

/**
 * # Credits list
 * The Art & Credits screen's scrolling list: the fan-project notice, then a titled section per group, each entry a
 * boxed row. Read-only: nothing in it is a control, so a swipe that lifts over a row fires nothing.
 *
 * @element mc-credits-list
 * @attr phone - The phone layout's smaller section titles.
 */
export class McCreditsList extends LitElement {
  static override styles = [ThemeStyles, McCreditsListStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare rows: readonly CreditsListRow[];
  declare phone: boolean;

  constructor() {
    super();
    this.rows = [];
    this.phone = false;
  }

  /** The scrolling element, for paging, the right stick and keeping a focused entry in view. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The element drawn for row `index`, for the focus ring. */
  rowElement(index: number): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-row="${index}"]`);
  }

  override render() {
    return html`<div class="scroller">
      <div class="rows" role="list">${this.rows.map((row, index) => this.#row(row, index))}</div>
    </div>`;
  }

  #row(row: CreditsListRow, index: number) {
    if (row.kind === "notice") return html`<div class="notice" role="listitem" data-row=${index}>${row.text}</div>`;
    if (row.kind === "section")
      return html`<div class="section" data-row=${index}>
        <h2 class="display">${row.title}</h2>
        <span class="count">${row.count}</span>
      </div>`;
    return html`<div class="entry" role="listitem" data-row=${index}>
      <p class="title">${row.title}</p>
      ${row.lines.length > 0 ? row.lines.map((line) => html`<p class=${line.tone}>${line.text}</p>`) : nothing}
    </div>`;
  }
}
