import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import "../mc-rules-entry/mc-rules-entry.js";
import { McRulesGlossaryStyles } from "./mc-rules-glossary.styles.js";
import type { McRulesGlossaryProps } from "./mc-rules-glossary.types.js";
import type { RulesEntryModel } from "../mc-rules-entry/mc-rules-entry.types.js";

/**
 * # Rules glossary
 * The Glossary tab: a natively scrolling grid of `mc-rules-entry` cards, one to three across, or what to say when the
 * search matches nothing.
 *
 * @element mc-rules-glossary
 */
export class McRulesGlossary extends RulesElement implements McRulesGlossaryProps {
  static override styles = [ThemeStyles, McRulesGlossaryStyles];

  static override properties: PropertyDeclarations = {
    entries: { attribute: false },
    empty: { type: String },
  };

  declare entries: readonly RulesEntryModel[];
  declare empty: string;

  constructor() {
    super();
    this.entries = [];
    this.empty = "";
  }

  /** The scrolling element: the stick and paging move it, and a focused entry scrolls into view in it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  override render() {
    if (this.entries.length === 0) return html`<mc-empty-state message=${this.empty}></mc-empty-state>`;
    return html`<div class="scroller">
      <div class="grid">
        ${repeat(
          this.entries,
          (entry) => entry.id,
          (entry) => html`<mc-rules-entry .entry=${entry}></mc-rules-entry>`,
        )}
      </div>
      ${nothing}
    </div>`;
  }
}
