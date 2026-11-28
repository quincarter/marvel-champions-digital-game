import { ThemeStyles } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { TrophyRoomElement } from "../shared/TrophyRoomElement.js";
import { McTrophySheetStyles } from "./mc-trophy-sheet.styles.js";
import type { McTrophySheetProps, TrophySheetModel } from "./mc-trophy-sheet.types.js";

/**
 * # Trophy sheet
 * One achievement spelled out in full, over the whole screen: its name, its state and reward and count in one line, what
 * it takes, and a Close button (stop `close`; the key hint is B). A scrim takes every press outside the box: a tap closes
 * the sheet and presses nothing beneath it (a tap, so the lift that ends a swipe never closes it).
 *
 * Needs `@mc/ui` defined (`mc-hint-button`).
 *
 * @element mc-trophy-sheet
 * @prop model - The achievement (`TrophySheetModel`); null draws nothing.
 * @fires mc-trophy-room - `{ type: "close" }`.
 */
export class McTrophySheet extends TrophyRoomElement implements McTrophySheetProps {
  static override styles = [ThemeStyles, McTrophySheetStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: TrophySheetModel | null;

  constructor() {
    super();
    this.model = null;
  }

  protected override act(action: string): void {
    if (action === "close") this.emit({ type: "close" });
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="scrim" data-action="close"></div>
      <section class="box" role="dialog" aria-modal="true" aria-label=${m.name}>
        <h2 class="name">${m.name}</h2>
        <div class="facts">${m.facts}</div>
        <div class="detail">${m.detail}</div>
        <mc-hint-button
          class="close"
          kind="primary"
          data-stop="close"
          data-key="close"
          .label=${m.closeLabel}
          .glyph=${hintGlyphOf(m.closeGlyph)}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.emit({ type: "close" });
          }}
        ></mc-hint-button>
      </section>`;
  }
}
