import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { PictureFit } from "../../shared/picture.types.js";
import "../mc-picture-tile/mc-picture-tile.js";
import type { McMediaRowStamp } from "./mc-media-row.types.js";
import { McMediaRowStyles } from "./mc-media-row.styles.js";

/**
 * # Media row
 * A framed row led by a picture (an `mc-picture-tile`, or a letter on ink while it has none), in two looks:
 *
 * - **pack** (default): a portrait picture at the left, then a title, a meta line, a summary (two lines at most), and
 *   along the foot a small note and a state badge at the right. A pack tile in the Mod Store. The row takes the press
 *   (a tap) where its owner wires one (`mc-sheet` does for a `mediaRow` node).
 * - **deck**: a deck with its hero. The picture carries aspect `stamps` along its foot, then a two line display title, a
 *   meta line, a record `badge` in the corner and a `foot` line; an optional `group` label sits above the card. A
 *   `selected` row inverts to ink; an `alert` row gets a heavier red outline and a red title; a `dim` row that is shown
 *   but not open fades. Decorative: the screen puts a tap area over it (press, hold, hover and focus belong to it).
 *
 * It is not `mc-list-row` (a round badge, a title and one detail line, no picture). Everything it says is passed in,
 * already translated. `mc-image-load` and `mc-image-error` from the picture bubble up.
 *
 * @element mc-media-row
 * @attr heading - The title.
 * @attr meta - The line under it.
 * @attr summary - Up to two lines (pack look).
 * @attr foot - A note at the foot, left.
 * @attr badge - The state badge words (a mark and a word, never colour alone).
 * @attr solid - The pack badge is the call to action (a red fill) rather than an outline.
 * @attr src - The picture URL; empty for none.
 * @attr letter - What the picture box says in big faint type while it has no picture (the pack initial).
 * @attr focus-x - Where the subject sits across the picture, 0 to 1 (`fit="cover"`).
 * @attr focus-y - Where the subject sits down the picture, 0 to 1 (`fit="cover"`).
 * @attr focus-centered - The crop is centered on the focal point (a hero focus.json) instead of a share of the overflow.
 * @attr fit - contain (default in the pack look) | cover (the deck look always crops).
 * @attr look - pack (default) | deck.
 * @attr art-width - The picture width in px (the pack look is 5:7 when 0).
 * @prop stamps - Stamps along the foot of the picture (`McMediaRowStamp`, deck look).
 * @attr group - A label above the card (deck look).
 * @attr group-height - The height the group label takes from the top (16).
 * @attr selected - The chosen row (deck look).
 * @attr alert - A problem row (deck look).
 * @attr dim - A faded row (deck look).
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
    focusX: { type: Number, attribute: "focus-x" },
    focusY: { type: Number, attribute: "focus-y" },
    focusCentered: { type: Boolean, attribute: "focus-centered" },
    fit: { type: String },
    look: { type: String, reflect: true },
    artWidth: { type: Number, attribute: "art-width" },
    stamps: { attribute: false },
    group: { type: String },
    groupHeight: { type: Number, attribute: "group-height" },
    selected: { type: Boolean },
    alert: { type: Boolean },
    dim: { type: Boolean },
  };

  declare heading: string;
  declare meta: string;
  declare summary: string;
  declare foot: string;
  declare badge: string;
  declare solid: boolean;
  declare src: string;
  declare letter: string;
  declare focusX: number;
  declare focusY: number;
  declare focusCentered: boolean;
  declare fit: PictureFit;
  declare look: "pack" | "deck";
  declare artWidth: number;
  declare stamps: readonly McMediaRowStamp[];
  declare group: string;
  declare groupHeight: number;
  declare selected: boolean;
  declare alert: boolean;
  declare dim: boolean;

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
    this.focusX = 0.5;
    this.focusY = 0.3;
    this.focusCentered = false;
    this.fit = "contain";
    this.look = "pack";
    this.artWidth = 0;
    this.stamps = [];
    this.group = "";
    this.groupHeight = 16;
    this.selected = false;
    this.alert = false;
    this.dim = false;
  }

  /** The picture element: where a card hover popover is wanted. */
  get artElement(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-picture-tile");
  }

  #art() {
    const deck = this.look === "deck";
    return html`<div class="art" style=${styleMap(this.artWidth > 0 ? { width: `${this.artWidth}px` } : {})}>
      <mc-picture-tile
        .src=${this.src}
        .missing=${this.letter}
        .letter=${true}
        .fit=${deck ? "cover" : this.fit}
        .subject=${{ x: this.focusX, y: this.focusY, centered: this.focusCentered }}
        .frame=${0}
        .ground=${deck ? "parchment" : "spent"}
      ></mc-picture-tile>
      ${
        this.stamps.length > 0
          ? html`<div class="stamps">
              ${this.stamps.map(
                (stamp) =>
                  html`<span class="stamp" style=${`background:${stamp.fill};color:${stamp.ink}`}
                    >${stamp.label}</span
                  >`,
              )}
            </div>`
          : nothing
      }
    </div>`;
  }

  override render() {
    const deck = this.look === "deck";
    const classes = [
      "row",
      this.look,
      this.selected ? "selected" : "",
      this.alert ? "alert" : "",
      this.dim && !this.selected ? "dim" : "",
    ];
    const top = deck ? (this.group ? this.groupHeight : 2) : 0;
    return html`${deck && this.group ? html`<div class="group">${this.group}</div>` : nothing}
      <div
        class=${classes.filter(Boolean).join(" ")}
        style=${styleMap(deck ? { top: `${top}px`, "--mc-art-width": `${this.artWidth}px` } : {})}
      >
        ${this.#art()}
        <div class=${deck && this.foot ? "text has-foot" : "text"}>
          <div class="heading">${this.heading}</div>
          <div class="meta">${this.meta}</div>
          ${this.summary ? html`<div class="summary">${this.summary}</div>` : nothing}
          <div class="footline">
            <span class="foot">${this.foot}</span>
            ${
              this.badge && !deck
                ? html`<span class="badge ${this.solid ? "solid" : ""}">${this.badge}</span>`
                : nothing
            }
          </div>
        </div>
        ${this.badge && deck ? html`<span class="badge corner">${this.badge}</span>` : nothing}
      </div>`;
  }
}
