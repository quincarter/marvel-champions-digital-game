import { html, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles, glyphLabelShift } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McBuilderHeaderStyles } from "./mc-builder-header.styles.js";
import type { BuilderHeaderModel, BuilderLayout } from "./mc-builder-header.types.js";

/**
 * # Builder header
 * The screen's title and Back. A long title (a campaign's own name) wraps; the scene measures the title box (`titleBox`)
 * and, where the dark mode toggle would sit over it, drops it (`drop`) or stops it short (`maxWidth`).
 *
 * Focus stop: `back`.
 *
 * @element mc-builder-header
 * @prop model - The header (`BuilderHeaderModel`).
 * @attr layout - wide | narrow | phone (the title is smaller on a phone).
 * @prop drop - How far the whole row drops, px, to clear the dark mode toggle.
 * @prop maxWidth - The longest the title may run, px (0: no limit).
 * @fires mc-deck-builder - `{ type: "back" }`.
 */
export class McBuilderHeader extends BuilderElement {
  static override styles = [ThemeStyles, McBuilderHeaderStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    layout: { type: String, reflect: true },
    drop: { type: Number },
    maxWidth: { type: Number },
  };

  declare model: BuilderHeaderModel | null;
  declare layout: BuilderLayout;
  declare drop: number;
  declare maxWidth: number;

  constructor() {
    super();
    this.model = null;
    this.layout = "wide";
    this.drop = 0;
    this.maxWidth = 0;
  }

  /**
   * The title set on one line at its natural size, whatever drop and limit are applied: what the scene measures to see
   * whether the dark mode toggle sits over the words (an element, so the scene reads its box in game coordinates).
   */
  get ghost(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".ghost");
  }

  override render() {
    const model = this.model;
    if (!model) return html``;
    const vars = {
      "--title-drop": `${this.drop}px`,
      ...(this.maxWidth > 0 ? { "--title-max": `${this.maxWidth}px` } : {}),
      "--mc-label-shift": `${glyphLabelShift(model.backGlyph)}px`,
    };
    return html`<h1 class="title" style=${styleMap(vars)}>${model.title}</h1>
      <span class="title ghost" aria-hidden="true">${model.title}</span>
      <div class="ctl" style=${styleMap(vars)}>
        <mc-button
          kind="secondary"
          display
          data-stop="back"
          data-key="back"
          .label=${model.backLabel}
          @mc-press=${this.send({ type: "back" })}
        ></mc-button>
        <mc-glyph-hint .glyph=${model.backGlyph}></mc-glyph-hint>
      </div>`;
  }
}
