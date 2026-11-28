import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitTextWithin } from "../../shared/fit-text.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { watchCard } from "../../shared/card-events.js";
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
 * @attr selected - The chosen card: a 4px red frame (the screen also says so in words, in the chip).
 * @attr activate-key - The key `mc-activate` carries; with none the card takes no press of its own.
 * @attr stop-key - The screen focus stop for this card (`data-stop` on its press button, read by `focusStopsOf`); the
 *   button also has an `inspect()` when there is an `inspect-key`.
 * @attr card-id - The card the picture shows: the mouse over the card raises `mc-card-hover` and `mc-card-hover-end`
 *   (`watchCard`); `card-face` (a property) is the face when it is not the card default.
 * @attr inspect-key - With an `activate-key`: a press-and-hold or a right-click raises `mc-inspect` with this key (the
 *   release that ended a hold is not a tap).
 * @fires mc-activate - `detail.key`: the card was tapped.
 * @fires mc-tile-focus - `detail.key`: the card's button took focus (the screen's keyboard route follows it).
 * @fires mc-inspect - `detail.key`: the card was held or right-clicked.
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
    selected: { type: Boolean, reflect: true },
    activateKey: { type: String, attribute: "activate-key" },
    stopKey: { type: String, attribute: "stop-key" },
    cardId: { type: String, attribute: "card-id" },
    cardFace: { attribute: false },
    inspectKey: { type: String, attribute: "inspect-key" },
    label: { type: String },
    failedSrc: { state: true },
  };

  declare model: McPictureCardModel | null;
  declare picture: PictureSource | null;
  declare lines: readonly TextLine[];
  declare stripe: readonly string[];
  declare artHeight: number;
  declare heavy: boolean;
  declare paper: boolean;
  declare selected: boolean;
  declare activateKey: string;
  declare stopKey: string;
  declare cardId: string;
  declare cardFace: unknown;
  declare inspectKey: string;
  /** The press control's accessible name; with none, the model's title, detail and chip. */
  declare label: string;
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
    this.selected = false;
    this.activateKey = "";
    this.stopKey = "";
    this.cardId = "";
    this.cardFace = undefined;
    this.inspectKey = "";
    this.label = "";
    this.failedSrc = "";
  }

  /** The picture element: where a card hover popover is wanted. */
  get artElement(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-picture-tile");
  }

  #detailClass(m: McPictureCardModel): string {
    return ["detail", m.detailTone !== "meta" ? m.detailTone : "", m.detailLines === 2 ? "two" : ""]
      .filter(Boolean)
      .join(" ");
  }

  #unwatch: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = watchCard(this, () => (this.cardId ? { cardId: this.cardId, face: this.cardFace } : null));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  override updated(): void {
    fitTextWithin(this.renderRoot);
    // A focus stop Inspect (`focusStopsOf` looks for an `inspect` method on the stop element).
    const button = this.renderRoot.querySelector<HTMLElement & { inspect?: () => void }>("button.tap");
    if (!button) return;
    if (this.inspectKey) {
      button.inspect = () =>
        this.dispatchEvent(
          new CustomEvent("mc-inspect", { detail: { key: this.inspectKey }, bubbles: true, composed: true }),
        );
    } else delete button.inspect;
  }

  #pressing = false;

  #activate(): void {
    this.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: this.activateKey }, bubbles: true, composed: true }),
    );
  }

  #nameOf(): string {
    const m = this.model;
    return m
      ? [m.title, m.detail, m.tag ?? "", ...(m.stamps ?? []).map((stamp) => stamp.label), m.chip]
          .filter((part) => part.length > 0)
          .join(", ")
      : "";
  }

  override render() {
    const m = this.model;
    if (!m && !this.picture) return nothing;
    const caption = m ? (m.captionHeight ?? 52) : 0;
    const art = this.artHeight > 0 ? `height:${this.artHeight}px` : `bottom:${caption}px`;
    // The chosen card (the attribute or the model) wears the heavy red frame; a heavy one (in use) the heavy ink frame.
    const chosen = this.selected || m?.selected === true;
    this.style.setProperty("--mc-card-border", chosen ? "4px" : this.heavy ? "5px" : "2px");
    this.style.setProperty("--mc-card-frame", chosen ? "var(--mc-line-red)" : "var(--mc-line-ink)");
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
                class=${m.titleDisplay ? "title display" : "title"}
                style=${m.titleDisplay && m.titleSize ? `font-size:${m.titleSize}px` : ""}
                .textContent=${m.title}
              ></div>
              <div class=${this.#detailClass(m)} .textContent=${m.detail}></div>
            </div>`
          : nothing
      }
      ${this.lines.length > 0 ? html`<div class="words" style=${`top:${this.artHeight + 6}px`}>${this.lines.map(lineOf)}</div>` : nothing}
      <div class="frame"></div>
      ${
        this.activateKey
          ? html`<button
              type="button"
              class="tap"
              data-stop=${this.stopKey || nothing}
              aria-label=${this.label || this.#nameOf() || nothing}
              aria-pressed=${this.selected || m?.selected === true ? "true" : "false"}
              @pointerdown=${() => {
                // A press focuses the button too, but the route must not chase it (it would scroll the tile under the finger).
                this.#pressing = true;
                setTimeout(() => (this.#pressing = false), 0);
              }}
              @focus=${() => {
                // The screen's own keyboard route and this native focus are one: it moves its focus to this tile (keyboard
                // or assistive-technology focus; a pointer press is the screen's own tap).
                if (this.#pressing) return;
                this.dispatchEvent(
                  new CustomEvent("mc-tile-focus", {
                    detail: { key: this.activateKey },
                    bubbles: true,
                    composed: true,
                  }),
                );
              }}
              @click=${(event: MouseEvent) => {
                // Enter or Space on the focused button (a pointer press goes through `tapped`).
                if (event.detail === 0) this.#activate();
              }}
              ${tapped(
                () => this.#activate(),
                this.inspectKey
                  ? () =>
                      this.dispatchEvent(
                        new CustomEvent("mc-inspect", {
                          detail: { key: this.inspectKey },
                          bubbles: true,
                          composed: true,
                        }),
                      )
                  : undefined,
              )}
            ></button>`
          : nothing
      }
    `;
  }
}
