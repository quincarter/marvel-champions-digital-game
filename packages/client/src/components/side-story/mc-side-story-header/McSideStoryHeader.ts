import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles, type HintGlyph } from "@mc/ui";
import { SideStoryElement } from "../shared/SideStoryElement.js";
import { McSideStoryHeaderStyles } from "./mc-side-story-header.styles.js";
import type { McSideStoryHeaderProps } from "./mc-side-story-header.types.js";

/**
 * # Side story header
 * The ink head of the reader: "SIDE STORY", the story's title, its credit, and CLOSE with the Start glyph while a keyboard
 * or pad is in use. CLOSE is the focus stop `close`.
 *
 * @element mc-side-story-header
 * @fires mc-side-story - `{ type: "close" }`.
 */
export class McSideStoryHeader extends SideStoryElement implements McSideStoryHeaderProps {
  static override styles = [ThemeStyles, McSideStoryHeaderStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    title: { type: String },
    credit: { type: String },
    closeLabel: { type: String, attribute: "close-label" },
    closeGlyph: { attribute: false },
    compact: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare title: string;
  declare credit: string;
  declare closeLabel: string;
  declare closeGlyph: HintGlyph | null;
  declare compact: boolean;

  constructor() {
    super();
    this.label = "";
    this.title = "";
    this.credit = "";
    this.closeLabel = "";
    this.closeGlyph = null;
    this.compact = false;
  }

  override render() {
    return html`<div class="words">
        <span class="label">${this.label}</span>
        <span class="title">${this.title}</span>
        <span class="credit">${this.credit}</span>
      </div>
      <mc-hint-button
        class="close"
        kind="onInk"
        data-stop="close"
        .label=${this.closeLabel}
        .glyph=${this.closeGlyph}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.emit({ type: "close" });
        }}
      ></mc-hint-button>`;
  }
}
