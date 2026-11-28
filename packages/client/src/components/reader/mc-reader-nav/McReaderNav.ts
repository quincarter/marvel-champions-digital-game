import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { ReaderElement } from "../shared/ReaderElement.js";
import { McReaderNavStyles } from "./mc-reader-nav.styles.js";
import type { McReaderNavProps } from "./mc-reader-nav.types.js";

/**
 * # Reader nav
 * The ink foot of the text: PREV and NEXT through the whole book, whatever the search shows. Each is a focus stop
 * (`prev`, `next`); at an end the button is dimmed and does nothing.
 *
 * @element mc-reader-nav
 * @fires mc-reader - `prev` and `next`.
 */
export class McReaderNav extends ReaderElement implements McReaderNavProps {
  static override styles = [ThemeStyles, McReaderNavStyles];

  static override properties: PropertyDeclarations = {
    wide: { type: Boolean, reflect: true },
    atStart: { type: Boolean, attribute: "at-start" },
    atEnd: { type: Boolean, attribute: "at-end" },
  };

  declare wide: boolean;
  declare atStart: boolean;
  declare atEnd: boolean;

  constructor() {
    super();
    this.wide = false;
    this.atStart = false;
    this.atEnd = false;
  }

  override render() {
    return html`<mc-button
        kind="onInk"
        data-stop="prev"
        .label=${t("reader.prev")}
        ?disabled=${this.atStart}
        @mc-press=${() => this.emit({ type: "prev" })}
      ></mc-button>
      <mc-button
        kind="onInk"
        data-stop="next"
        .label=${t("reader.next")}
        ?disabled=${this.atEnd}
        @mc-press=${() => this.emit({ type: "next" })}
      ></mc-button>`;
  }
}
