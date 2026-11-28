import { html, LitElement, type PropertyDeclarations } from "lit";
import { McDetailFactStyles } from "./mc-detail-fact.styles.js";

/**
 * # Detail fact
 * A small label over its words on the hero detail panel ("OBLIGATION" over the obligation card's name). Both arrive
 * translated. The label is a tracked caption; the words wrap.
 *
 * @element mc-detail-fact
 * @prop label - The caption.
 * @prop text - The words under it.
 */
export class McDetailFact extends LitElement {
  static override styles = [McDetailFactStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    text: { type: String },
  };

  declare label: string;
  declare text: string;

  constructor() {
    super();
    this.label = "";
    this.text = "";
  }

  override render() {
    return html`<span class="label">${this.label}</span><span class="text">${this.text}</span>`;
  }
}
