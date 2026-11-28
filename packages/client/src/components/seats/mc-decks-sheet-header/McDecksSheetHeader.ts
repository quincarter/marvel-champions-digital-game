import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McDecksSheetHeaderStyles } from "./mc-decks-sheet-header.styles.js";

/**
 * # Pick a deck header
 * The sheet's title (the hero's name, in the display face, cut with an ellipsis rather than wrapped) and the line under it
 * ("3 decks. Pick the one this seat plays.", at most two lines). Words only; both arrive translated.
 *
 * @element mc-decks-sheet-header
 * @prop heading - The title.
 * @prop subtitle - The line under it; empty for none.
 */
export class McDecksSheetHeader extends LitElement {
  static override styles = [ThemeStyles, McDecksSheetHeaderStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    subtitle: { type: String },
  };

  declare heading: string;
  declare subtitle: string;

  constructor() {
    super();
    this.heading = "";
    this.subtitle = "";
  }

  override render() {
    return html`<h2 class="title">${this.heading}</h2>
      ${this.subtitle === "" ? nothing : html`<p class="subtitle">${this.subtitle}</p>`}`;
  }
}
