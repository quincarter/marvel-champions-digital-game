import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../../shared/theme.styles.js";
import "../../mc-search-field/mc-search-field.js";
import type { McSearchField } from "../../mc-search-field/McSearchField.js";
import "../mc-toc/mc-toc.js";
import type { McToc } from "../mc-toc/McToc.js";
import type { McTocRow } from "../mc-toc/mc-toc.types.js";
import { McSearchHitsStyles } from "./mc-search-hits.styles.js";
import type { McSearchHitsProps } from "./mc-search-hits.types.js";

/**
 * # Search hits
 * A search field with the list of what it found under it. Typing raises the field's own debounced `mc-search`; the
 * screen matches (accent-free, fuzzy) and hands back `rows`; a row press is `mc-activate` from the list.
 *
 * @element mc-search-hits
 * @slot after - Between the field and the list.
 * @fires mc-search - From the field.
 * @fires mc-search-focus - From the field.
 * @fires mc-activate - From the list.
 */
export class McSearchHits extends LitElement implements McSearchHitsProps {
  static override styles = [ThemeStyles, McSearchHitsStyles];

  static override properties: PropertyDeclarations = {
    query: { type: String },
    placeholder: { type: String },
    focusPlaceholder: { type: String, attribute: "focus-placeholder" },
    clearLabel: { type: String, attribute: "clear-label" },
    rows: { attribute: false },
    selected: { type: String },
    empty: { type: String },
    searchStop: { type: String, attribute: "search-stop" },
  };

  declare query: string;
  declare placeholder: string;
  declare focusPlaceholder: string;
  declare clearLabel: string;
  declare rows: readonly McTocRow[];
  declare selected: string;
  declare empty: string;
  declare searchStop: string;

  constructor() {
    super();
    this.query = "";
    this.placeholder = "";
    this.focusPlaceholder = "";
    this.clearLabel = "";
    this.rows = [];
    this.selected = "";
    this.empty = "";
    this.searchStop = "search";
  }

  /** The field, for its caret (the screen's Escape and pad rules). */
  get field(): McSearchField | null {
    return this.renderRoot.querySelector("mc-search-field");
  }

  /** The list, for its scroller. */
  get toc(): McToc | null {
    return this.renderRoot.querySelector("mc-toc");
  }

  override render() {
    return html`<mc-search-field
        data-stop=${this.searchStop}
        .value=${this.query}
        .placeholder=${this.placeholder}
        .focusPlaceholder=${this.focusPlaceholder}
        .clearLabel=${this.clearLabel}
      ></mc-search-field>
      <slot name="after"></slot>
      <mc-toc .rows=${this.rows} .selected=${this.selected} .empty=${this.empty}></mc-toc>`;
  }
}
