import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchField, type McSearchHits, type McTocRow } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { ReaderElement } from "../shared/ReaderElement.js";
import { McReaderContentsStyles } from "./mc-reader-contents.styles.js";
import type { McReaderContentsProps } from "./mc-reader-contents.types.js";

/**
 * # Reader contents
 * The book's table of contents with its search: the field, a phone's PDF buttons under it, and the rows the search
 * left (every section while the field is empty). Matching is the scene's (`searchBook`: accent-free, forgiving of a
 * typo in a title); this says what was typed and which row was pressed.
 *
 * @element mc-reader-contents
 * @fires mc-reader - `search`, `search-focus` and `toc`.
 */
export class McReaderContents extends ReaderElement implements McReaderContentsProps {
  static override styles = [ThemeStyles, McReaderContentsStyles];

  static override properties: PropertyDeclarations = {
    query: { type: String },
    padKeyboard: { type: Boolean, attribute: "pad-keyboard" },
    hits: { attribute: false },
    current: { type: String },
    pdfs: { attribute: false },
  };

  declare query: string;
  declare padKeyboard: boolean;
  declare hits: readonly McTocRow[];
  declare current: string;
  declare pdfs: readonly string[];

  constructor() {
    super();
    this.query = "";
    this.padKeyboard = false;
    this.hits = [];
    this.current = "";
    this.pdfs = [];
  }

  /** The search field, for its caret (the scene's Escape and pad rules). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector<McSearchHits>("mc-search-hits")?.field ?? null;
  }

  /** The list's scroller. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McSearchHits>("mc-search-hits")?.toc?.scroller ?? null;
  }

  override render() {
    return html`<mc-search-hits
      .query=${this.query}
      .placeholder=${t("reader.search")}
      .focusPlaceholder=${this.padKeyboard ? t("reader.steamKeyboard") : ""}
      .clearLabel=${t("reader.clear")}
      .rows=${this.hits}
      .selected=${this.current}
      .empty=${t("reader.noMatch")}
      @mc-search=${(event: CustomEvent<{ value: string }>) => {
        event.stopPropagation();
        this.emit({ type: "search", value: event.detail.value });
      }}
      @mc-search-focus=${(event: CustomEvent<{ focused: boolean }>) => {
        event.stopPropagation();
        this.emit({ type: "search-focus", focused: event.detail.focused });
      }}
      @mc-activate=${(event: CustomEvent<{ key: string }>) => {
        event.stopPropagation();
        const index = Number(event.detail.key.slice("toc:".length));
        if (Number.isInteger(index)) this.emit({ type: "toc", index });
      }}
    >
      ${this.pdfs.length > 0 ? html`<mc-reader-pdfs slot="after" .labels=${this.pdfs}></mc-reader-pdfs>` : nothing}
    </mc-search-hits>`;
  }
}
