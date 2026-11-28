/**
 * The Mod Store, the page: only composes. The header (Back, the title with its BETA tag, About mods) over either the
 * browse view (the beta caption, the six tabs, the offline strip, the Update all bar, the search and filters, then a grid of
 * pack tiles or the Credits list) or one pack's page (pictures, title, text, gallery, status, buttons), with the first-run
 * heads-up about mods over the lot while it is open. Each part is its own element in `components/mod-store/`; this file
 * registers them once (shared `@mc/ui` elements are defined by the ui entry) and holds only what crosses them: the layout
 * size and the model the scene builds.
 *
 * In: `size` and the `model`. Out: `mc-mod-store` (`ModStoreEventDetail`) from the parts, the search box's `mc-search` and
 * `mc-search-focus`, `mc-image-error` and the card hover and Inspect events from the card pictures.
 */
import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchField } from "@mc/ui";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { ModStoreElement } from "../../../components/mod-store/shared/ModStoreElement.js";
import "../../../components/mod-store/mc-mod-beta-caption/mc-mod-beta-caption.js";
import "../../../components/mod-store/mc-mod-tabs/mc-mod-tabs.js";
import "../../../components/mod-store/mc-mod-message/mc-mod-message.js";
import "../../../components/mod-store/mc-mod-update-bar/mc-mod-update-bar.js";
import "../../../components/mod-store/mc-mod-finders/mc-mod-finders.js";
import "../../../components/mod-store/mc-pack-grid/mc-pack-grid.js";
import "../../../components/mod-store/mc-creator-list/mc-creator-list.js";
import "../../../components/mod-store/mc-pack-detail/mc-pack-detail.js";
import "../../../components/mod-store/mc-mod-notice/mc-mod-notice.js";
import { McModStorePageStyles } from "./mc-mod-store-page.styles.js";
import { ModStoreResponsiveStyles } from "./responsive.styles.js";
import type { BrowseModel, ModStorePageModel, ModStoreSize } from "./mc-mod-store-page.types.js";
import type { McModFinders } from "../../../components/mod-store/mc-mod-finders/McModFinders.js";
import type { McPackDetail } from "../../../components/mod-store/mc-pack-detail/McPackDetail.js";
import type { McPackGrid } from "../../../components/mod-store/mc-pack-grid/McPackGrid.js";
import type { McCreatorList } from "../../../components/mod-store/mc-creator-list/McCreatorList.js";

export class McModStorePage extends ModStoreElement {
  static override styles = [ThemeStyles, McModStorePageStyles, ModStoreResponsiveStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    model: { attribute: false },
  };

  declare size: ModStoreSize;
  declare model: ModStorePageModel | null;

  constructor() {
    super();
    this.size = "wide";
    this.model = null;
  }

  /** The search box, while the finders are drawn (the scene's Escape and focus rules). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector<McModFinders>("mc-mod-finders")?.searchField ?? null;
  }

  /** The native scrollers on screen, the one the pad's stick moves first: the gallery, the grid, the credits, the text. */
  get scrollers(): readonly HTMLElement[] {
    const root = this.renderRoot;
    const detail = root.querySelector<McPackDetail>("mc-pack-detail")?.scrollers ?? [];
    const grid = root.querySelector<McPackGrid>("mc-pack-grid")?.scroller ?? null;
    const credits = root.querySelector<McCreatorList>("mc-creator-list")?.scroller ?? null;
    return [...detail, ...[grid, credits].filter((one): one is HTMLElement => one !== null)];
  }

  protected override updated(): void {
    this.emitRendered();
  }

  #browse(browse: BrowseModel) {
    const { body, finders } = browse;
    return html`<div class="browse">
      <mc-mod-beta-caption
        .size=${this.size}
        .heading=${browse.caption.heading}
        .body=${browse.caption.body}
      ></mc-mod-beta-caption>
      <mc-mod-tabs
        .tabs=${browse.tabs}
        .selected=${browse.selected}
        .toggleLabel=${browse.toggle.label}
        .toggleShown=${browse.toggle.shown}
        .toggleOpen=${browse.toggle.open}
      ></mc-mod-tabs>
      ${browse.offline ? html`<mc-mod-message kind="offline" .text=${browse.offline}></mc-mod-message>` : nothing}
      ${browse.updateBar ? html`<mc-mod-update-bar .size=${this.size} .bar=${browse.updateBar}></mc-mod-update-bar>` : nothing}
      ${
        finders
          ? html`<mc-mod-finders
              .size=${this.size}
              .search=${finders.search}
              .sortLabel=${finders.sortLabel}
              .chips=${finders.chips}
              .clearLabel=${finders.clearLabel}
              .countText=${finders.countText}
            ></mc-mod-finders>`
          : nothing
      }
      ${
        body.kind === "grid"
          ? html`<mc-pack-grid
              .size=${this.size}
              .tiles=${body.tiles}
              .listId=${body.listId}
              .scrollFrom=${body.scrollFrom}
            ></mc-pack-grid>`
          : body.kind === "credits"
            ? html`<mc-creator-list
                .size=${this.size}
                .intro=${body.intro}
                .empty=${body.empty}
                .credits=${body.credits}
              ></mc-creator-list>`
            : html`<mc-mod-message .text=${body.text} .retryLabel=${body.retryLabel}></mc-mod-message>`
      }
    </div>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const head = model.header;
    const phone = this.size === "phone";
    return html`<mc-top-bar
        class="header"
        ?compact=${phone}
        .heading=${head.heading}
        .backLabel=${head.backLabel}
        .backGlyph=${hintGlyphOf(head.backGlyph)}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.emit({ type: "back" });
        }}
      >
        ${!phone && head.badge ? html`<span slot="end" class="badge">${head.badge}</span>` : nothing}
        ${head.installedText ? html`<span slot="end" class="installed">${head.installedText}</span>` : nothing}
        <mc-hint-button
          slot="end"
          class="about"
          data-stop="about"
          kind="onInk"
          display
          .label=${head.aboutLabel}
          .glyph=${hintGlyphOf(head.aboutGlyph)}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.emit({ type: "about" });
          }}
        ></mc-hint-button>
      </mc-top-bar>
      ${
        model.detail
          ? html`<mc-pack-detail .size=${this.size} .pack=${model.detail}></mc-pack-detail>`
          : model.browse
            ? this.#browse(model.browse)
            : nothing
      }
      ${
        model.notice
          ? html`<mc-mod-notice
              .size=${this.size}
              .lines=${model.notice.lines}
              .buttons=${model.notice.buttons}
              .closeGlyph=${model.notice.closeGlyph}
            ></mc-mod-notice>`
          : nothing
      }`;
  }
}

if (!customElements.get("mc-mod-store-page")) {
  customElements.define("mc-mod-store-page", McModStorePage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-store-page": McModStorePage;
  }
}
