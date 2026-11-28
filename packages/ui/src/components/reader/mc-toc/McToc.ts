import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../../shared/theme.styles.js";
import { tapped } from "../../../shared/tapped.js";
import "../../mc-empty-state/mc-empty-state.js";
import { McTocStyles } from "./mc-toc.styles.js";
import type { McTocRow } from "./mc-toc.types.js";

/**
 * # Table of contents
 * A scrolling list of section rows with the open one marked. Pressed by a tap only (never the lift that ends a swipe);
 * the focus route presses a row with `click()`, which has no pointer behind it (`detail` 0) and so counts too.
 *
 * @element mc-toc
 * @prop rows - `McTocRow[]`.
 * @attr selected - The open row key.
 * @attr empty - What to say when there are no rows.
 * @fires mc-activate - `{ key }`: a row was pressed.
 */
/** Raises `mc-activate` for the row `key`. */
const activate = (host: HTMLElement, key: string): void => {
  host.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
};

export class McToc extends LitElement {
  static override styles = [ThemeStyles, McTocStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
    selected: { type: String, reflect: true },
    empty: { type: String },
  };

  declare rows: readonly McTocRow[];
  declare selected: string;
  declare empty: string;

  constructor() {
    super();
    this.rows = [];
    this.selected = "";
    this.empty = "";
  }

  /** The scrolling element (the stick and paging move it). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  override render() {
    if (this.rows.length === 0) {
      return this.empty ? html`<mc-empty-state message=${this.empty} size="13"></mc-empty-state>` : nothing;
    }
    return html`<div class="scroller" role="list">
      ${repeat(
        this.rows,
        (row) => row.key,
        (row) =>
          html`<div
            class="row"
            role="listitem"
            data-stop=${row.key}
            ?data-selected=${row.key === this.selected}
            aria-current=${row.key === this.selected ? "true" : "false"}
            ${tapped(() => activate(this, row.key))}
            @click=${(event: MouseEvent) => {
              if (event.detail === 0) activate(this, row.key);
            }}
          >
            <span class="title">${row.title}</span>
          </div>`,
      )}
    </div>`;
  }
}
