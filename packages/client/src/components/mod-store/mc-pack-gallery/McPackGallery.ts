import { html, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { keepScroll, restoreScroll } from "../shared/list-scroll.js";
import "../mc-pack-card/mc-pack-card.js";
import { McPackGalleryStyles } from "./mc-pack-gallery.styles.js";
import type { GallerySectionModel, McPackGalleryProps } from "./mc-pack-gallery.types.js";
import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";

/**
 * # Pack gallery
 * A scrolling gallery of the pack's cards in groups (hero, villain, nemesis and obligation, deck), each group a heading
 * and a grid of `mc-pack-card`s, with a count line over the lot. Pictures load lazily as the tiles scroll into view;
 * where it was scrolled to is kept by `listId`. The cards raise the hover popover and Inspect themselves.
 *
 * @element mc-pack-gallery
 */
export class McPackGallery extends ModStoreElement implements McPackGalleryProps {
  static override styles = [ThemeStyles, McPackGalleryStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    heading: { type: String },
    listId: { type: String, attribute: "list-id" },
    sections: { attribute: false },
  };

  declare size: ModStoreSize;
  declare heading: string;
  declare listId: string;
  declare sections: readonly GallerySectionModel[];

  constructor() {
    super();
    this.size = "wide";
    this.heading = "";
    this.listId = "";
    this.sections = [];
  }

  /** The native scroller: what the pad's stick and paging move. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("listId") || changed.has("sections")) restoreScroll(this.listId, this.scroller);
    this.emitRendered();
  }

  override render() {
    return html`<div class="count">${this.heading}</div>
      <div
        class="scroller list"
        data-key="list:gallery"
        @scroll=${(event: Event) => keepScroll(this.listId, (event.target as HTMLElement).scrollTop)}
      >
        ${repeat(
          this.sections,
          (section) => section.title,
          (section) =>
            html`<div class="head">${section.title} · ${section.cards.length}</div>
              <div class="tiles">
                ${repeat(
                  section.cards,
                  (card) => card.key,
                  (card) => html`<mc-pack-card .card=${card}></mc-pack-card>`,
                )}
              </div>`,
        )}
      </div>`;
  }
}
