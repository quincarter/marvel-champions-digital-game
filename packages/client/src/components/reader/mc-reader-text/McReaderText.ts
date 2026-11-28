import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McArticleModel } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { ReaderElement } from "../shared/ReaderElement.js";
import { McReaderTextStyles } from "./mc-reader-text.styles.js";
import type { McReaderTextProps } from "./mc-reader-text.types.js";

/**
 * # Reader text
 * The open section: a row of tools over a natively scrolling article. A wide screen puts the PDF buttons at the right of
 * the row; a phone puts a CONTENTS button there instead, to go back to the list.
 *
 * @element mc-reader-text
 * @fires mc-reader - `contents` (and `pdf` from the buttons in the tools row).
 */
export class McReaderText extends ReaderElement implements McReaderTextProps {
  static override styles = [ThemeStyles, McReaderTextStyles];

  static override properties: PropertyDeclarations = {
    wide: { type: Boolean, reflect: true },
    article: { attribute: false },
    pictureMax: { type: Number, attribute: "picture-max" },
    pdfs: { attribute: false },
  };

  declare wide: boolean;
  declare article: McArticleModel | null;
  declare pictureMax: number;
  declare pdfs: readonly string[];

  constructor() {
    super();
    this.wide = false;
    this.article = null;
    this.pictureMax = 480;
    this.pdfs = [];
  }

  /** The article's scrolling element: the stick and paging move it, and a new section starts from its top. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement & { scroller: HTMLElement | null }>("mc-article")?.scroller ?? null;
  }

  #tools() {
    if (!this.wide) {
      return html`<div class="tools">
        <mc-button
          class="contents"
          kind="secondary"
          data-stop="contents"
          .label=${t("reader.contents")}
          @mc-press=${() => this.emit({ type: "contents" })}
        ></mc-button>
      </div>`;
    }
    return this.pdfs.length > 0
      ? html`<div class="tools"><mc-reader-pdfs .labels=${this.pdfs}></mc-reader-pdfs></div>`
      : nothing;
  }

  override render() {
    return html`${this.#tools()}<mc-article
        .model=${this.article}
        .pictureMax=${this.pictureMax}
        .pad=${this.wide ? 28 : 16}
      ></mc-article>`;
  }
}
