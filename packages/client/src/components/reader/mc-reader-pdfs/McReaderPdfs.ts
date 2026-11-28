import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { ReaderElement } from "../shared/ReaderElement.js";
import { McReaderPdfsStyles } from "./mc-reader-pdfs.styles.js";
import type { McReaderPdfsProps } from "./mc-reader-pdfs.types.js";

/**
 * # Reader PDFs
 * One button per PDF of the book, side by side: each opens the repo's copy of the original. A focus stop per button,
 * `pdf:<index>`.
 *
 * @element mc-reader-pdfs
 * @fires mc-reader - `{ type: "pdf", index }`.
 */
export class McReaderPdfs extends ReaderElement implements McReaderPdfsProps {
  static override styles = [ThemeStyles, McReaderPdfsStyles];

  static override properties: PropertyDeclarations = {
    labels: { attribute: false },
  };

  declare labels: readonly string[];

  constructor() {
    super();
    this.labels = [];
  }

  override render() {
    return html`${repeat(
      this.labels,
      (label) => label,
      (label, index) =>
        html`<mc-button
          kind="secondary"
          data-stop=${`pdf:${index}`}
          .label=${`${label} ↗`}
          @mc-press=${() => this.emit({ type: "pdf", index })}
        ></mc-button>`,
    )}`;
  }
}
