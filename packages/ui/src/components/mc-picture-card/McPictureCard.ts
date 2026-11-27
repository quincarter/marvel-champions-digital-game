import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitTextWithin } from "../../shared/fit-text.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { tapped } from "../../shared/tapped.js";
import { lineOf } from "../../shared/text-line.js";
import type { TextLine } from "../../shared/text-line.types.js";
import "../mc-picture-tile/mc-picture-tile.js";
import type { PictureErrorDetail } from "../mc-picture-tile/mc-picture-tile.types.js";
import type { McPictureCardModel } from "./mc-picture-card.types.js";
import { McPictureCardStyles } from "./mc-picture-card.styles.js";

/**
 * # Picture card
 * A shelf card: an `mc-picture-tile` over its words, in one ink frame. Two ways to fill it, which can be mixed:
 *
 * - a `model` (`McPictureCardModel`): the picture cropped around a focal point (a gray faded ghost when `dim`), a status
 *   chip on it and a caption strip with a title and a detail line. With no picture, or one that fails to load, the
 *   faint `initial` stands in. Decorative: the screen puts a tap area over it.
 * - `picture` (`PictureSource`), `lines` (`TextLine`s under the picture, each shrinking to fit), an optional `stripe` of
 *   colours across the picture foot, an `art-height`, and a `heavy` frame (selected, or the one in use). With an
 *   `activate-key` the card takes its own tap and raises `mc-activate`; a swipe lift does not.
 *
 * `mc-image-load` and `mc-image-error` from the picture bubble up unchanged.
 *
 * @element mc-picture-card
 * @prop model - A chip-and-caption card (`McPictureCardModel`).
 * @prop picture - The picture as one value; overrides the model picture.
 * @prop lines - Words under the picture.
 * @prop stripe - Stripe colours across the picture foot (CSS colours), equal shares.
 * @attr art-height - The picture height in px; 0 (default) fills the card above the model caption strip.
 * @attr heavy - The heavier frame.
 * @attr paper - A paper ground instead of parchment.
 * @attr activate-key - The key `mc-activate` carries; with none the card takes no press of its own.
 * @fires mc-activate - `detail.key`: the card was tapped.
 */
export class McPictureCard extends LitElement {
  static override styles = [ThemeStyles, McPictureCardStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    picture: { attribute: false },
    lines: { attribute: false },
    stripe: { attribute: false },
    artHeight: { type: Number, attribute: "art-height" },
    heavy: { type: Boolean, reflect: true },
    paper: { type: Boolean, reflect: true },
    activateKey: { type: String, attribute: "activate-key" },
    failedSrc: { state: true },
  };

  declare model: McPictureCardModel | null;
  declare picture: PictureSource | null;
  declare lines: readonly TextLine[];
  declare stripe: readonly string[];
  declare artHeight: number;
  declare heavy: boolean;
  declare paper: boolean;
  declare activateKey: string;
  /** The URL that failed to load, so the initial stands in for it. */
  declare failedSrc: string;

  constructor() {
    super();
    this.model = null;
    this.picture = null;
    this.lines = [];
    this.stripe = [];
    this.artHeight = 0;
    this.heavy = false;
    this.paper = false;
    this.activateKey = "";
    this.failedSrc = "";
  }

  /** The picture element: where a card hover popover is wanted. */
  get artElement(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-picture-tile");
  }

  override updated(): void {
    fitTextWithin(this.renderRoot);
  }

  override render() {
    const m = this.model;
    if (!m && !this.picture) return nothing;
    const caption = m ? (m.captionHeight ?? 52) : 0;
    const art = this.artHeight > 0 ? `height:${this.artHeight}px` : `bottom:${caption}px`;
    // The chosen card wears the heavy red frame; a heavy one (in use) the heavy ink frame.
    this.style.setProperty("--mc-card-border", m?.selected ? "4px" : this.heavy ? "5px" : "2px");
    this.style.setProperty("--mc-card-line", m?.selected ? "var(--mc-line-red)" : "var(--mc-line-ink)");
    const picture: PictureSource | null =
      this.picture ?? (m && m.src ? { src: m.src, cover: { x: 0.5, y: m.focusY } } : null);
    const gone = !picture?.src || picture.src === this.failedSrc;
    const stamps = m?.stamps ?? [];
    return html`
      <div class="art" style=${art}>
        ${
          picture
            ? html`<mc-picture-tile
                .picture=${picture}
                .frame=${this.picture ? 2 : 0}
                .dim=${m?.dim ?? false}
                ground="ink"
                @mc-image-error=${(event: CustomEvent<PictureErrorDetail>) => {
                  this.failedSrc = event.detail.src;
                }}
              ></mc-picture-tile>`
            : nothing
        }
        ${
          m && gone
            ? html`<span class="initial" style=${`font-size:${Math.round(this.clientHeight * 0.3)}px`}
                >${m.initial}</span
              >`
            : nothing
        }
        ${m?.chip ? html`<span class=${m.chipTone === "locked" ? "chip locked" : "chip"}>${m.chip}</span>` : nothing}
        ${m?.plate ? html`<span class="plate" data-fit>${m.plate}</span>` : nothing}
        ${m?.tag ? html`<span class="tag">${m.tag}</span>` : nothing}
        ${
          stamps.length > 0
            ? html`<span class="stamps"
                >${stamps.map(
                  (stamp) =>
                    html`<span class="stamp" style=${`background:${stamp.fill};color:${stamp.ink}`}
                      >${stamp.label}</span
                    >`,
                )}</span
              >`
            : nothing
        }
      </div>
      ${
        this.stripe.length > 0
          ? html`<div class="stripe" style=${`top:${Math.max(0, this.artHeight - 7)}px`}>
              ${this.stripe.map((color) => html`<span style=${`background:${color}`}></span>`)}
            </div>`
          : nothing
      }
      ${
        m
          ? html`<div class="caption" style=${`height:${caption}px`}>
              <div
                class=${m.displayTitle ? "title display" : "title"}
                style=${m.displayTitle ? `font-size:${m.displayTitle}px` : ""}
              >
                ${m.title}
              </div>
              <div
                class=${`detail ${m.detailTone === "meta" ? "" : m.detailTone} ${m.detailLines === 2 ? "two" : ""}`.replace(/s+/g, " ").trim()}
              >
                ${m.detail}
              </div>
            </div>`
          : nothing
      }
      ${this.lines.length > 0 ? html`<div class="words" style=${`top:${this.artHeight + 6}px`}>${this.lines.map(lineOf)}</div>` : nothing}
      <div class="frame"></div>
      ${
        this.activateKey
          ? html`<div
              class="tap"
              ${tapped(() =>
                this.dispatchEvent(
                  new CustomEvent("mc-activate", { detail: { key: this.activateKey }, bubbles: true, composed: true }),
                ),
              )}
            ></div>`
          : nothing
      }
    `;
  }
}
