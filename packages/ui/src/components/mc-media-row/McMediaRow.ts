import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { PictureFit } from "../../shared/picture.types.js";
import "../mc-picture-tile/mc-picture-tile.js";
import { McMediaRowStyles } from "./mc-media-row.styles.js";

/**
 * # Media row
 * A framed row: a portrait picture (an `mc-picture-tile`, or a letter on ink while it has none) at the left, then a
 * title, a meta line, a summary (two lines at most), and along the foot a small note and a state badge at the right. A
 * pack tile in the Mod Store; any list whose rows are "a picture, what it is, and where it stands". It is not
 * `mc-list-row` (a round badge, a title and one detail line, no picture). The row takes the press (a tap) where its
 * owner wires one (`mc-sheet` does for a `mediaRow` node); the picture is decorative. Everything it says is passed in,
 * already translated. `mc-image-load` and `mc-image-error` from the picture bubble up.
 *
 * @element mc-media-row
 * @attr heading - The title (cut with an ellipsis on its line).
 * @attr meta - The line under it.
 * @attr summary - Up to two lines.
 * @attr foot - A note at the foot, left (a size).
 * @attr badge - The state badge words, at the foot, right (a mark and a word, never colour alone).
 * @attr solid - The badge is the call to action (a red fill) rather than an outline.
 * @attr src - The picture URL; empty for none.
 * @attr letter - What the picture box says in big faint type while it has no picture (the pack initial).
 * @attr focus-y - Where the subject sits down the picture, 0 to 1 (`fit="cover"`).
 * @attr fit - contain (default) | cover.
 */
export class McMediaRow extends LitElement {
  static override styles = [ThemeStyles, McMediaRowStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    meta: { type: String },
    summary: { type: String },
    foot: { type: String },
    badge: { type: String },
    solid: { type: Boolean },
    src: { type: String },
    letter: { type: String },
    focusY: { type: Number, attribute: "focus-y" },
    fit: { type: String },
  };

  declare heading: string;
  declare meta: string;
  declare summary: string;
  declare foot: string;
  declare badge: string;
  declare solid: boolean;
  declare src: string;
  declare letter: string;
  declare focusY: number;
  declare fit: PictureFit;

  constructor() {
    super();
    this.heading = "";
    this.meta = "";
    this.summary = "";
    this.foot = "";
    this.badge = "";
    this.solid = false;
    this.src = "";
    this.letter = "";
    this.focusY = 0.3;
    this.fit = "contain";
  }

  override render() {
    return html`<div class="row">
      <mc-picture-tile
        class="art"
        .src=${this.src}
        .missing=${this.letter}
        .letter=${true}
        .fit=${this.fit}
        .subject=${{ x: 0.5, y: this.focusY }}
        .frame=${0}
      ></mc-picture-tile>
      <div class="text">
        <div class="heading">${this.heading}</div>
        <div class="meta">${this.meta}</div>
        <div class="summary">${this.summary}</div>
        <div class="footline">
          <span class="foot">${this.foot}</span>
          ${this.badge ? html`<span class="badge ${this.solid ? "solid" : ""}">${this.badge}</span>` : nothing}
        </div>
      </div>
    </div>`;
  }
}
