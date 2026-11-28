/**
 * The deck builder, the page: only composes. The header, the identity step (a hero picker, then "Start from" for a hero with
 * a precon) or the builder itself: the chosen identity, and either the wide layout's three columns (the aspect / filter /
 * chart rail, the card pool, "Your deck" on an ink ground) or a narrow layout's tab strip with one tab's body and the pinned
 * Save bar. Each part is its own element in `components/deck-builder/`; this file registers them once (shared `@mc/ui`
 * elements are defined by the ui entry) and holds only what crosses them: which layout the scene says is current, and where the
 * open aspect tip's plate points.
 *
 * In: `layout` and the `model`. Out: `mc-deck-builder` (`DeckBuilderEventDetail`) from the parts,
 * `mc-window` from the pool, `mc-image-error`, and the card hover and Inspect events from the card pictures.
 */
import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { BuilderElement } from "../../../components/deck-builder/shared/BuilderElement.js";
import "../../../components/deck-builder/mc-identity-picker/mc-identity-picker.js";
import "../../../components/deck-builder/mc-start-from/mc-start-from.js";
import "../../../components/deck-builder/mc-identity-row/mc-identity-row.js";
import "../../../components/deck-builder/mc-aspect-picker/mc-aspect-picker.js";
import "../../../components/deck-builder/mc-type-filters/mc-type-filters.js";
import "../../../components/deck-builder/mc-show-toggles/mc-show-toggles.js";
import "../../../components/deck-builder/mc-quick-filters/mc-quick-filters.js";
import "../../../components/deck-builder/mc-pack-sort/mc-pack-sort.js";
import "../../../components/deck-builder/mc-pool-search/mc-pool-search.js";
import "../../../components/deck-builder/mc-pool-list/mc-pool-list.js";
import "../../../components/deck-builder/mc-deck-charts/mc-deck-charts.js";
import "../../../components/deck-builder/mc-deck-name/mc-deck-name.js";
import "../../../components/deck-builder/mc-legality-lines/mc-legality-lines.js";
import "../../../components/deck-builder/mc-rewards-strip/mc-rewards-strip.js";
import "../../../components/deck-builder/mc-builder-tabs/mc-builder-tabs.js";
import "../../../components/deck-builder/mc-deck-list/mc-deck-list.js";
import "../../../components/deck-builder/mc-games-panel/mc-games-panel.js";
import "../../../components/deck-builder/mc-builder-actions/mc-builder-actions.js";
import "../../../components/deck-builder/mc-builder-save-bar/mc-builder-save-bar.js";
import type { McAspectPicker } from "../../../components/deck-builder/mc-aspect-picker/McAspectPicker.js";
import type { McPoolList } from "../../../components/deck-builder/mc-pool-list/McPoolList.js";
import type { McDeckList } from "../../../components/deck-builder/mc-deck-list/McDeckList.js";
import type { McDeckName } from "../../../components/deck-builder/mc-deck-name/McDeckName.js";
import type { McPoolSearch } from "../../../components/deck-builder/mc-pool-search/McPoolSearch.js";
import type { McIdentityPicker } from "../../../components/deck-builder/mc-identity-picker/McIdentityPicker.js";
import { BUILDER_RENDERED } from "../../../components/deck-builder/shared/deck-builder-events.types.js";
import { McDeckBuilderPageStyles } from "./mc-deck-builder-page.styles.js";
import { DeckBuilderResponsiveStyles } from "./responsive.styles.js";
import type { BuildModel, BuilderLayout, DeckBuilderPageModel } from "./mc-deck-builder-page.types.js";

export class McDeckBuilderPage extends BuilderElement {
  static override styles = [ThemeStyles, McDeckBuilderPageStyles, DeckBuilderResponsiveStyles];

  static override properties: PropertyDeclarations = {
    layout: { type: String, reflect: true },
    model: { attribute: false },
    anchorEl: { state: true },
  };

  declare layout: BuilderLayout;
  declare model: DeckBuilderPageModel | null;
  /** The open tip's "i" segment: what its plate points at. */
  declare anchorEl: HTMLElement | null;

  constructor() {
    super();
    this.layout = "wide";
    this.model = null;
    this.anchorEl = null;
  }

  #find<T extends Element>(selector: string): T | null {
    return this.renderRoot.querySelector<T>(selector);
  }

  /** The pool list: where the stops of cards out of the window come from. */
  get poolList(): McPoolList | null {
    return this.#find<McPoolList>("mc-pool-list");
  }

  /** The pool search field and the name field: the scene's `restoreValue` and blur reach them. */
  get searchRow(): McPoolSearch | null {
    return this.#find<McPoolSearch>("mc-pool-search");
  }

  get nameField(): McDeckName | null {
    return this.#find<McDeckName>("mc-deck-name");
  }

  /** The first scrolling list on screen: what the pad's paging and right stick move. */
  get mainScroller(): HTMLElement | null {
    const pool = this.poolList?.scroller ?? null;
    const heroes = this.#find<McIdentityPicker>("mc-identity-picker")?.scroller ?? null;
    return (
      pool ??
      heroes ??
      this.#find<HTMLElement>(".filters") ??
      this.#find<HTMLElement>(".scroll") ??
      this.#find<HTMLElement>("mc-deck-list")?.shadowRoot?.querySelector<HTMLElement>(".groups") ??
      null
    );
  }

  /** Every list that scrolls on screen now, by name: the scene keeps where each was left (a tab's body is new each time). */
  scrollers(): ReadonlyMap<string, HTMLElement> {
    const found = new Map<string, HTMLElement>();
    const pool = this.poolList?.scroller;
    if (pool) found.set("pool", pool);
    const heroes = this.#find<McIdentityPicker>("mc-identity-picker")?.scroller;
    if (heroes) found.set("identity", heroes);
    for (const element of this.renderRoot.querySelectorAll<HTMLElement>("[data-scroll]"))
      found.set(element.dataset.scroll!, element);
    const deck = this.#find<McDeckList>("mc-deck-list")?.scroller;
    if (deck) found.set("rail-deck", deck);
    return found;
  }

  protected override updated(): void {
    const open = this.model?.tip?.aspect ?? null;
    const picker = this.#find<McAspectPicker>("mc-aspect-picker");
    if (open && picker) {
      void picker.infoElementOf(open).then((found) => {
        if ((this.model?.tip?.aspect ?? null) === open && found !== this.anchorEl) this.anchorEl = found;
      });
    } else if (this.anchorEl) this.anchorEl = null;
    this.dispatchEvent(new CustomEvent(BUILDER_RENDERED, { bubbles: true, composed: true }));
  }

  // ---- The filters, in the layouts that show them ---------------------------------------------------------------------

  #filters(build: BuildModel, withShows: boolean, quickToo = true) {
    return html`${withShows ? html`<mc-show-toggles .model=${build.shows}></mc-show-toggles>` : nothing}
      <mc-type-filters .model=${build.types}></mc-type-filters>
      ${quickToo ? html`<mc-quick-filters .model=${build.quick}></mc-quick-filters>` : nothing}
      <mc-pack-sort .model=${build.packs}></mc-pack-sort>`;
  }

  #foldToggle(build: BuildModel) {
    const fold = build.fold;
    if (!fold) return nothing;
    const label = `${fold.open ? "▾" : "▸"} ${fold.label}${fold.active > 0 ? ` · ${fold.active}` : ""}`;
    return html`<mc-button
      class="filters-toggle"
      kind="secondary"
      data-stop="filters-toggle"
      .label=${label}
      ?selected=${fold.active > 0}
      @mc-press=${this.send({ type: "filters-toggle" })}
    ></mc-button>`;
  }

  #pool(build: BuildModel) {
    return html`<mc-pool-list .model=${build.pool}></mc-pool-list>`;
  }

  // ---- The wide layout --------------------------------------------------------------------------------------------------

  #wide(build: BuildModel) {
    const fold = build.fold;
    const filtersOpen = fold?.open === true;
    return html`<div class="wide body">
      <aside class="rail-left">
        <mc-aspect-picker .model=${build.aspects}></mc-aspect-picker>
        ${fold ? nothing : this.#filters(build, false, false)}
        <mc-deck-charts mode="tabs" .tab=${build.chartTab} .model=${build.charts}></mc-deck-charts>
      </aside>
      <section class="mid">
        <div class="label">${fold ? `${build.poolLabel} — ${build.countText}` : build.poolLabel}</div>
        ${
          fold
            ? html`<div class="search-row">
                <mc-pool-search .model=${build.search}></mc-pool-search>
                ${this.#foldToggle(build)}
              </div>`
            : html`<mc-pool-search .model=${build.search}></mc-pool-search>
                <mc-quick-filters .model=${build.quick}></mc-quick-filters>
                <div class="toggle-row">
                  <mc-show-toggles inline .model=${build.shows}></mc-show-toggles>
                </div>`
        }
        ${
          filtersOpen
            ? html`<div class="scroll filters" data-scroll="filters">${this.#filters(build, true)}</div>`
            : this.#pool(build)
        }
      </section>
      <aside class="rail-right">
        ${build.name ? html`<mc-deck-name .model=${build.name}></mc-deck-name>` : nothing}
        <mc-legality-lines on-dark .model=${build.legality}></mc-legality-lines>
        <mc-rewards-strip .model=${build.rewards}></mc-rewards-strip>
        <mc-builder-tabs .model=${build.rail}></mc-builder-tabs>
        ${
          build.railTab === "games"
            ? html`<div class="scroll" data-scroll="games">
                <mc-games-panel on-dark .model=${build.games}></mc-games-panel>
              </div>`
            : html`<mc-deck-list on-dark .model=${build.deckList}></mc-deck-list>`
        }
        <mc-builder-actions on-dark .model=${build.actions}></mc-builder-actions>
        <mc-builder-save-bar .model=${build.save}></mc-builder-save-bar>
      </aside>
    </div>`;
  }

  // ---- The narrow layout ------------------------------------------------------------------------------------------------

  #narrowPool(build: BuildModel) {
    const fold = build.fold;
    return html`<mc-pool-search .model=${build.search}></mc-pool-search> ${
        fold
          ? html`<div class="toggle-row">${this.#foldToggle(build)}<span class="count">${build.countText}</span></div>`
          : nothing
      }
      ${
        fold?.open
          ? html`<div class="scroll filters" data-scroll="filters">${this.#filters(build, true)}</div>`
          : html`${fold ? nothing : this.#filters(build, true)}
            ${fold ? nothing : html`<div class="label">${build.poolLabel} — ${build.countText}</div>`}
            ${this.#pool(build)}`
      }`;
  }

  #narrowDeck(build: BuildModel) {
    return html`<div class="scroll" data-scroll="deck">
        <mc-aspect-picker .model=${build.aspects}></mc-aspect-picker>
        ${build.name ? html`<mc-deck-name .model=${build.name}></mc-deck-name>` : nothing}
        <mc-legality-lines .model=${build.legality}></mc-legality-lines>
        <mc-rewards-strip .model=${build.rewards}></mc-rewards-strip>
        <mc-deck-charts mode="stacked" .model=${build.charts}></mc-deck-charts>
        <mc-deck-list flow .model=${build.deckList}></mc-deck-list>
        <mc-builder-actions .model=${build.actions}></mc-builder-actions>
      </div>
      <mc-builder-save-bar class="save" .model=${build.save}></mc-builder-save-bar>`;
  }

  #narrow(build: BuildModel) {
    return html`<div class="body">
      <mc-builder-tabs .model=${build.tabs}></mc-builder-tabs>
      ${
        build.tab === "games"
          ? html`<div class="scroll" data-scroll="games"><mc-games-panel .model=${build.games}></mc-games-panel></div>`
          : build.tab === "deck"
            ? this.#narrowDeck(build)
            : this.#narrowPool(build)
      }
    </div>`;
  }

  // ---- The page ---------------------------------------------------------------------------------------------------------

  #tip() {
    const tip = this.model?.tip;
    if (!tip) return nothing;
    return html`<mc-tip-plate
      data-key="aspect-tip-plate"
      .anchor=${this.anchorEl}
      .heading=${tip.heading}
      .tagline=${tip.tagline}
      .body=${tip.body}
      .linkLabel=${tip.linkLabel}
      .linkReason=${tip.linkReason}
      .linkAvailable=${tip.linkAvailable}
      link-stop="aspect-tip-link"
      @mc-tip-close=${this.send({ type: "tip-close" })}
      @mc-tip-link=${this.send({ type: "tip-link", aspect: tip.aspect })}
      @mc-tip-hover=${(event: CustomEvent<{ over: boolean }>) => {
        event.stopPropagation();
        this.emit({ type: "tip-hover", over: event.detail.over });
      }}
    ></mc-tip-plate>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { build } = model;
    return html`<div class="page">
        <mc-top-bar class="header" tone="paper" ?compact=${this.layout === "phone"} .heading=${model.header.title}>
          <mc-hint-button
            slot="end"
            class="back"
            data-stop="back"
            kind="secondary"
            display
            .label=${model.header.backLabel}
            .glyph=${hintGlyphOf(model.header.backGlyph)}
            @mc-press=${this.send({ type: "back" })}
          ></mc-hint-button>
        </mc-top-bar>
        ${model.stage === "pick" && model.pick ? html`<mc-identity-picker .model=${model.pick}></mc-identity-picker>` : nothing}
        ${model.stage === "start" && model.start ? html`<mc-start-from .model=${model.start}></mc-start-from>` : nothing}
        ${
          model.stage === "build" && build
            ? html`<mc-identity-row .layout=${this.layout} .model=${build.identity}></mc-identity-row>
                ${this.layout === "wide" ? this.#wide(build) : this.#narrow(build)}`
            : nothing
        }
      </div>
      ${this.#tip()}`;
  }
}

if (!customElements.get("mc-deck-builder-page")) {
  customElements.define("mc-deck-builder-page", McDeckBuilderPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-builder-page": McDeckBuilderPage;
  }
}
