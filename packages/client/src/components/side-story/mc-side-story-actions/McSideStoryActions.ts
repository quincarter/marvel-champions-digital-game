import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type HintGlyph } from "@mc/ui";
import { SideStoryElement } from "../shared/SideStoryElement.js";
import { McSideStoryActionsStyles } from "./mc-side-story-actions.styles.js";
import type { McSideStoryActionsProps } from "./mc-side-story-actions.types.js";

/**
 * # Side story actions
 * The ink action bar: BACK (from the second beat on) and the big primary NEXT, or DONE on the last beat, with the
 * Activate glyph while a keyboard or pad is in use. Focus stops `back` and `next`.
 *
 * @element mc-side-story-actions
 * @fires mc-side-story - `back` and `next`.
 */
export class McSideStoryActions extends SideStoryElement implements McSideStoryActionsProps {
  static override styles = [ThemeStyles, McSideStoryActionsStyles];

  static override properties: PropertyDeclarations = {
    hasBack: { type: Boolean, attribute: "has-back" },
    backLabel: { type: String, attribute: "back-label" },
    nextLabel: { type: String, attribute: "next-label" },
    nextGlyph: { attribute: false },
    compact: { type: Boolean, reflect: true },
  };

  declare hasBack: boolean;
  declare backLabel: string;
  declare nextLabel: string;
  declare nextGlyph: HintGlyph | null;
  declare compact: boolean;

  constructor() {
    super();
    this.hasBack = false;
    this.backLabel = "";
    this.nextLabel = "";
    this.nextGlyph = null;
    this.compact = false;
  }

  override render() {
    return html`${
      this.hasBack
        ? html`<mc-button
            class="back"
            kind="onInk"
            data-stop="back"
            .label=${this.backLabel}
            @mc-press=${() => this.emit({ type: "back" })}
          ></mc-button>`
        : nothing
    }<mc-hint-button
        class="next"
        kind="primary"
        display
        data-stop="next"
        .label=${this.nextLabel}
        .glyph=${this.nextGlyph}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.emit({ type: "next" });
        }}
      ></mc-hint-button>`;
  }
}
