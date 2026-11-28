import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import "../mc-pack-faces/mc-pack-faces.js";
import "../mc-pack-title/mc-pack-title.js";
import "../mc-pack-text/mc-pack-text.js";
import "../mc-pack-gallery/mc-pack-gallery.js";
import "../mc-pack-status/mc-pack-status.js";
import "../mc-pack-actions/mc-pack-actions.js";
import { McPackDetailStyles } from "./mc-pack-detail.styles.js";
import type { McPackDetailProps, PackDetailModel } from "./mc-pack-detail.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";
import type { McPackText } from "../mc-pack-text/McPackText.js";
import type { McPackGallery } from "../mc-pack-gallery/McPackGallery.js";

/**
 * # Pack detail
 * One pack's page, composed of its parts: the pictures that lead it, the title block, the scrolling text, a gallery of the
 * pack's cards, the status line and the buttons its state offers. The parts sit in a flex column; on a wide screen the text
 * sits beside the pictures under the title, on a phone (or for a pack with no pictures) under the header, sharing the
 * height with the gallery by 34:66. The gallery takes the rest, never over the buttons.
 *
 * @element mc-pack-detail
 */
export class McPackDetail extends ModStoreElement implements McPackDetailProps {
  static override styles = [ThemeStyles, McPackDetailStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    pack: { attribute: false },
    square: { type: Boolean, reflect: true },
    gallery: { type: Boolean, reflect: true },
  };

  declare size: ModStoreSize;
  declare pack: PackDetailModel | null;
  /** The pack has neither a cover nor a featured card: one square slot leads the page (reflected, for the layout). */
  declare square: boolean;
  /** The pack has cards to show: the gallery takes a share of the height (reflected, for the layout). */
  declare gallery: boolean;

  constructor() {
    super();
    this.size = "wide";
    this.pack = null;
    this.square = false;
    this.gallery = false;
  }

  /** The native scrollers the pad's stick moves: the gallery first, then the text. */
  get scrollers(): readonly HTMLElement[] {
    const gallery = this.renderRoot.querySelector<McPackGallery>("mc-pack-gallery")?.scroller ?? null;
    const text = this.renderRoot.querySelector<McPackText>("mc-pack-text")?.scroller ?? null;
    return [gallery, text].filter((one): one is HTMLElement => one !== null);
  }

  protected override willUpdate(): void {
    this.square = this.pack?.pictures.square != null;
    this.gallery = this.pack?.gallery != null;
  }

  protected override updated(): void {
    this.emitRendered();
  }

  override render() {
    const pack = this.pack;
    if (!pack) return nothing;
    const text = html`<mc-pack-text .body=${pack.body} .listId=${pack.textId}></mc-pack-text>`;
    const beside = this.size === "wide" && !this.square;
    return html`<div class="page">
      <div class="head">
        <mc-pack-faces .pictures=${pack.pictures}></mc-pack-faces>
        <div class="side">
          <mc-pack-title .size=${this.size} .pack=${pack.title}></mc-pack-title>
          ${beside ? text : nothing}
        </div>
      </div>
      ${beside ? nothing : text}
      ${
        pack.gallery
          ? html`<mc-pack-gallery
              .size=${this.size}
              .heading=${pack.gallery.heading}
              .listId=${pack.gallery.listId}
              .sections=${pack.gallery.sections}
            ></mc-pack-gallery>`
          : nothing
      }
      <mc-pack-status .status=${pack.status}></mc-pack-status>
      <mc-pack-actions .size=${this.size} .actions=${pack.actions}></mc-pack-actions>
    </div>`;
  }
}
