import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../../shared/theme.styles.js";
import { McReaderStyles } from "./mc-reader.styles.js";
import type { McReaderPane } from "./mc-reader.types.js";

/**
 * # Reader
 * The frame of a reading screen (a book, a rules reference, a comic): a bar across the top, an optional toolbar, then a
 * side pane (the contents) beside a main pane (the text) with an optional foot under it. A narrow screen shows one pane
 * at a time (`pane`). Only layout: what goes in each slot belongs to the screen.
 *
 * @element mc-reader
 * @attr wide - The side pane sits beside the main pane.
 * @attr pane - Narrow only: `side` or `main`, the one shown.
 * @attr no-side - There is no side pane.
 * @slot bar - The ink bar.
 * @slot toolbar - A full-width row under the bar (tabs, a search).
 * @slot side - The contents.
 * @slot main - The text.
 * @slot foot - A row under the text.
 */
export class McReader extends LitElement {
  static override styles = [ThemeStyles, McReaderStyles];

  static override properties: PropertyDeclarations = {
    wide: { type: Boolean, reflect: true },
    pane: { type: String, reflect: true },
    noSide: { type: Boolean, reflect: true, attribute: "no-side" },
  };

  declare wide: boolean;
  declare pane: McReaderPane;
  declare noSide: boolean;

  constructor() {
    super();
    this.wide = false;
    this.pane = "side";
    this.noSide = false;
  }

  override render() {
    return html`<div class="bar"><slot name="bar"></slot></div>
      <div class="toolbar"><slot name="toolbar"></slot></div>
      <div class="body">
        <div class="side"><slot name="side"></slot></div>
        <div class="main">
          <div class="text"><slot name="main"></slot></div>
          <slot name="foot"></slot>
        </div>
      </div>`;
  }
}
