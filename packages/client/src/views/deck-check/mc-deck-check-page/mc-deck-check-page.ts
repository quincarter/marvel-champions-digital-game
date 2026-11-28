/**
 * Deck check, the page: only composes. The header, then either the wide layout's three columns (the rail of aspect
 * segments, type filter and cost curve; the deck's cards; the ink list panel) or a narrow layout's tab strip, one tab's
 * body and the ink footer. Each part is its own element in `components/deck-check/`; this file registers them once
 * (shared `@mc/ui` elements are defined by the ui entry) and holds only what crosses them: which tab and filter the
 * scene says is current, and where the open aspect tip's plate goes.
 *
 * In: `size`, `tab`, `typeFilter`, `openTip` and the `model`. Out: `mc-deck-check` (`DeckCheckEventDetail`) from the
 * parts, `mc-image-error` and the card hover and Inspect events from the card pictures.
 */
import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type TipRect } from "@mc/ui";
import { DeckCheckElement } from "../../../components/deck-check/shared/DeckCheckElement.js";
import "../../../components/deck-check/mc-deck-check-header/mc-deck-check-header.js";
import "../../../components/deck-check/mc-deck-composition/mc-deck-composition.js";
import "../../../components/deck-check/mc-deck-type-filter/mc-deck-type-filter.js";
import "../../../components/deck-check/mc-cost-curve/mc-cost-curve.js";
import "../../../components/deck-check/mc-deck-summary/mc-deck-summary.js";
import "../../../components/deck-check/mc-deck-group-tiles/mc-deck-group-tiles.js";
import "../../../components/deck-check/mc-deck-actions/mc-deck-actions.js";
import "../../../components/deck-check/mc-deck-list-panel/mc-deck-list-panel.js";
import "../../../components/deck-check/mc-deck-card-sections/mc-deck-card-sections.js";
import { McDeckCheckPageStyles } from "./mc-deck-check-page.styles.js";
import { DeckCheckResponsiveStyles } from "./responsive.styles.js";
import type { DeckCheckPageModel, DeckCheckSize, DeckCheckTab } from "./mc-deck-check-page.types.js";
import type { McDeckComposition } from "../../../components/deck-check/mc-deck-composition/McDeckComposition.js";
import type { McDeckCardSections } from "../../../components/deck-check/mc-deck-card-sections/McDeckCardSections.js";

const same = (a: TipRect | null, b: TipRect | null): boolean =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

export class McDeckCheckPage extends DeckCheckElement {
  static override styles = [ThemeStyles, McDeckCheckPageStyles, DeckCheckResponsiveStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    tab: { type: String },
    typeFilter: { type: String, attribute: "type-filter" },
    openTip: { attribute: false },
    model: { attribute: false },
    tipAnchor: { state: true },
    pageBox: { state: true },
  };

  declare size: DeckCheckSize;
  declare tab: DeckCheckTab;
  declare typeFilter: string;
  declare openTip: string | null;
  declare model: DeckCheckPageModel | null;
  declare tipAnchor: TipRect | null;
  declare pageBox: TipRect;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.size = "wide";
    this.tab = "curve";
    this.typeFilter = "all";
    this.openTip = null;
    this.model = null;
    this.tipAnchor = null;
    this.pageBox = { x: 0, y: 0, width: 0, height: 0 };
  }

  /** The card list's native scroller: what the pad's stick and paging move. */
  get cardScroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McDeckCardSections>("mc-deck-card-sections")?.scroller ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === "undefined") return;
    this.#resize = new ResizeObserver(() => this.#seatTip());
    this.#resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override updated(): void {
    this.#seatTip();
    this.emitRendered();
  }

  /** Reads where the open tip's segment is, in this page's own coordinates, so its plate sits beside it. */
  #seatTip(): void {
    const box: TipRect = { x: 0, y: 0, width: this.offsetWidth, height: this.offsetHeight };
    if (!same(box, this.pageBox)) this.pageBox = box;
    const segment = this.openTip
      ? this.renderRoot.querySelector<McDeckComposition>("mc-deck-composition")?.anchorOf(this.openTip)
      : null;
    let anchor: TipRect | null = null;
    if (segment) {
      const own = this.getBoundingClientRect();
      const at = segment.getBoundingClientRect();
      // The panel layer may be scaled: this page's laid-out width against its box on screen.
      const scale = this.offsetWidth > 0 ? own.width / this.offsetWidth : 1;
      anchor = {
        x: (at.left - own.left) / scale,
        y: (at.top - own.top) / scale,
        width: at.width / scale,
        height: at.height / scale,
      };
    }
    if (!same(anchor, this.tipAnchor)) this.tipAnchor = anchor;
  }

  #tabBody(model: DeckCheckPageModel) {
    if (this.tab === "aspect") {
      return html`<div class="tab-body scroll">
        <mc-deck-group-tiles
          .heading=${model.composition.heading}
          .tiles=${model.composition.tiles}
          .empty=${model.composition.empty}
        ></mc-deck-group-tiles>
      </div>`;
    }
    if (this.tab === "cards") {
      return html`<div class="tab-body">
        <mc-button
          class="sort"
          kind="secondary"
          data-stop="deck-sort"
          data-key="deck-sort"
          .label=${model.sortLabel}
          @mc-press=${() => this.emit({ type: "sort" })}
        ></mc-button>
        ${this.#cards(model)}
      </div>`;
    }
    return html`<div class="tab-body scroll">
      <mc-cost-curve
        framed
        .heading=${model.curve.heading}
        .average=${model.curve.average}
        .bars=${model.curve.bars}
      ></mc-cost-curve>
      <mc-deck-summary .tiles=${model.curve.tiles} .rows=${model.curve.rows}></mc-deck-summary>
    </div>`;
  }

  #cards(model: DeckCheckPageModel) {
    return html`<mc-deck-card-sections
      .faces=${model.cards.faces}
      .groups=${model.cards.groups}
      .note=${model.cards.note}
      .cardScale=${model.cards.cardScale}
      .desktop=${model.cards.desktop}
    ></mc-deck-card-sections>`;
  }

  #actions(model: DeckCheckPageModel, layout: "stack" | "row", slot?: string) {
    return html`<mc-deck-actions
      slot=${slot ?? nothing}
      .layout=${layout}
      .editLabel=${model.actions.editLabel}
      .startLabel=${model.actions.startLabel}
      .startUnavailable=${model.actions.startUnavailable}
    ></mc-deck-actions>`;
  }

  #wide(model: DeckCheckPageModel) {
    const { rail } = model;
    return html`<div class="wide">
      <aside class="rail">
        <mc-deck-composition
          .heading=${rail.aspectHeading}
          .segments=${rail.aspects}
          .openTip=${this.openTip}
        ></mc-deck-composition>
        <mc-deck-type-filter
          .heading=${rail.filterHeading}
          .chips=${rail.chips}
          .selected=${this.typeFilter}
        ></mc-deck-type-filter>
        <mc-cost-curve .heading=${rail.curveHeading} .bars=${rail.bars}></mc-cost-curve>
      </aside>
      ${this.#cards(model)}
      <mc-deck-list-panel
        .heading=${model.panel.heading}
        .sortLabel=${model.sortLabel}
        .groups=${model.panel.groups}
        .more=${model.panel.more}
      >
        ${this.#actions(model, "stack", "actions")}
      </mc-deck-list-panel>
    </div>`;
  }

  #narrow(model: DeckCheckPageModel) {
    return html`<div class="narrow">
      <div class="column">
        <mc-tab-rail
          .tabs=${model.tabs}
          .selected=${this.tab}
          @mc-activate=${(event: CustomEvent<{ id: string }>) => {
            event.stopPropagation();
            this.emit({ type: "tab", tab: event.detail.id as DeckCheckTab });
          }}
        ></mc-tab-rail>
        ${this.#tabBody(model)}
      </div>
      <div class="footer">${this.#actions(model, "row")}</div>
    </div>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const tip = this.openTip ? model.rail.tips[this.openTip] : undefined;
    return html`<mc-deck-check-header
        .size=${this.size}
        .backLabel=${model.header.backLabel}
        .title=${model.header.title}
        .badgeText=${model.header.badgeText}
        .badgeTone=${model.header.badgeTone}
        .meta=${model.header.meta}
      ></mc-deck-check-header>
      ${this.size === "wide" ? this.#wide(model) : this.#narrow(model)}
      ${
        tip && this.size === "wide"
          ? html`<mc-tip-plate
              data-key="aspect-tip-plate"
              .text=${tip}
              .anchor=${this.tipAnchor}
              .viewport=${this.pageBox}
              @mc-tip-dismiss=${(event: Event) => {
                event.stopPropagation();
                this.emit({ type: "tip-close" });
              }}
            ></mc-tip-plate>`
          : nothing
      }`;
  }
}

if (!customElements.get("mc-deck-check-page")) {
  customElements.define("mc-deck-check-page", McDeckCheckPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-check-page": McDeckCheckPage;
  }
}
