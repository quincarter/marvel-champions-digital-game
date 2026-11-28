import { html, LitElement, type PropertyDeclarations } from "lit";
import { McStatsNoteStyles } from "./mc-stats-note.styles.js";
import type { McStatsNoteProps } from "./mc-stats-note.types.js";

/**
 * # Stats note
 * A line of small print between the rows: why a tab is empty, that older games are being read, what a filter does not
 * apply to. Words only, written as given.
 *
 * @element mc-stats-note
 * @attr text - The note's words.
 */
export class McStatsNote extends LitElement implements McStatsNoteProps {
  static override styles = McStatsNoteStyles;

  static override properties: PropertyDeclarations = { text: { type: String } };

  declare text: string;

  constructor() {
    super();
    this.text = "";
  }

  override render() {
    return html`<span>${this.text}</span>`;
  }
}
