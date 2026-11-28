import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import { watchCard } from "../../shared/card-events.js";
import "../mc-empty-state/mc-empty-state.js";
import "../mc-picture-tile/mc-picture-tile.js";
import "../mc-section-header/mc-section-header.js";
import { SCROLL_GUTTER } from "../mc-sheet/McSheet.js";
import type { CardCellModel, CardFaceTileModel, CardSection, CardSectionsModel } from "./mc-card-sections.types.js";

const styles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .scroller {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
  }
  .head {
    height: 34px;
  }
  .faces,
  .cards {
    display: flex;
    flex-wrap: wrap;
    padding: 0 4px 10px;
  }
  .face {
    position: relative;
    flex: none;
    cursor: pointer;
  }
  .face mc-picture-tile {
    display: block;
  }
  .face .label {
    margin-top: 3px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .face .name {
    font-family: var(--mc-font-display);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell {
    position: relative;
    flex: none;
    margin: 2px 4px;
    background: var(--mc-fill-card);
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .cell .top {
    display: flex;
    height: 46px;
    flex: none;
    border-bottom: 2px solid var(--mc-line-ink);
  }
  .pip {
    flex: none;
    width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    color: var(--mc-text-paper);
    background: var(--mc-fill-ink);
  }
  .who {
    min-width: 0;
    padding: 2px 32px 0 6px;
  }
  .who .name {
    font-family: var(--mc-font-display);
    font-size: 12px;
    line-height: 1.1;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .who .type {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .art {
    position: relative;
    flex: 1;
    min-height: 0;
    margin: 2px;
  }
  .art mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  .rules {
    flex: none;
    height: 34px;
    padding: 4px 6px 0;
    border-top: 2px solid var(--mc-line-ink);
    font-size: var(--mc-small-9, 9px);
    line-height: 1.25;
    opacity: 0.75;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .qty {
    position: absolute;
    right: 0;
    top: 0;
    padding: 2px 5px;
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    color: var(--mc-text-paper);
    background: var(--mc-fill-heal);
  }
  .note {
    padding: 10px;
    font-size: 14px;
    opacity: 0.75;
  }
`;

/**
 * # Card sections
 * A deck's own cards as a scrolling list of sections: a titled row of face tiles (an identity's faces, a multi-faced
 * card's), a titled grid of card cells (cost pip, name and type, the scan, a short strip of rules, a "x2" copies badge)
 * and plain notes. A tap on a face raises `mc-activate` with `face:<id>`, on a cell with `card:<id>`; there is no other
 * press (the list's one action is "look at this"). `elementOf` finds each by key and `hoverFaces()` gives the pictures a
 * card hover popover wants.
 *
 * @element mc-card-sections
 * @prop model - What to draw (`CardSectionsModel`).
 * @fires mc-activate - `detail.key`.
 */
export class McCardSections extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: CardSectionsModel;

  constructor() {
    super();
    this.model = { sections: [], contentWidth: 0, columns: 1, cellHeight: 200, gap: 0 };
  }

  /** Each card picture's `watchCard` (hover and Inspect events), by the item that holds it. */
  readonly #watched = new Map<Element, () => void>();

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const stop of this.#watched.values()) stop();
    this.#watched.clear();
  }

  /** Every card picture raises the card hover and Inspect events (`watchCard`); gone pictures are let go. */
  protected override updated(): void {
    const items = new Set(this.renderRoot.querySelectorAll<HTMLElement>("[data-card]"));
    for (const [item, stop] of this.#watched) {
      if (items.has(item as HTMLElement)) continue;
      stop();
      this.#watched.delete(item);
    }
    for (const item of items) {
      const picture = item.querySelector<HTMLElement>("mc-picture-tile");
      if (!picture || this.#watched.has(item)) continue;
      this.#watched.set(
        item,
        watchCard(picture, () => {
          const face = this.#faceOf(item.dataset.key ?? "");
          return { cardId: item.dataset.card!, ...(face !== undefined ? { face } : {}) };
        }),
      );
    }
  }

  /** The face a `face:<id>` item shows, when its tile names one. */
  #faceOf(key: string): unknown {
    for (const section of this.model.sections) {
      if (section.kind !== "faces") continue;
      const tile = section.tiles.find((t) => `face:${t.id}` === key);
      if (tile) return tile.face;
    }
    return undefined;
  }

  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  /** The scans, with their cards: where a hover popover is wanted. */
  hoverFaces(): { readonly cardId: string; readonly element: HTMLElement; readonly key: string }[] {
    const found: { cardId: string; element: HTMLElement; key: string }[] = [];
    for (const item of this.renderRoot.querySelectorAll<HTMLElement>("[data-card]")) {
      const element = item.querySelector<HTMLElement>("mc-picture-tile");
      if (element) found.push({ cardId: item.dataset.card!, element, key: item.dataset.key! });
    }
    return found;
  }

  #press(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  #face(tile: CardFaceTileModel, width: number, height: number, gap: number) {
    return html`<div
      class="face"
      data-key=${`face:${tile.id}`}
      data-stop=${`face:${tile.id}`}
      data-card=${tile.cardId}
      style=${`width:${width}px;margin:0 ${gap}px ${gap}px 0`}
      ${tapped(() => this.#press(`face:${tile.id}`))}
    >
      <mc-picture-tile .picture=${tile.picture} style=${`height:${height}px`}></mc-picture-tile>
      <div class="label">${tile.label}</div>
      <div class="name">${tile.name}</div>
    </div>`;
  }

  #cell(cell: CardCellModel, width: number, height: number) {
    return html`<div
      class="cell"
      data-key=${`card:${cell.id}`}
      data-stop=${`card:${cell.id}`}
      data-card=${cell.cardId}
      style=${`width:${width}px;height:${height}px`}
      ${tapped(() => this.#press(`card:${cell.id}`))}
    >
      <div class="top">
        <div class="pip" style=${cell.cost !== null ? `background:${cell.costColor}` : nothing}>${cell.cost ?? ""}</div>
        <div class="who">
          <div class="name">${cell.name}</div>
          <div class="type">${cell.typeWord}</div>
        </div>
      </div>
      <div class="art"><mc-picture-tile .picture=${cell.picture} .frame=${0}></mc-picture-tile></div>
      <div class="rules">${cell.rules}</div>
      <div class="qty">×${cell.quantity}</div>
    </div>`;
  }

  #section(section: CardSection) {
    const { contentWidth, columns, cellHeight, gap } = this.model;
    if (section.kind === "note") return html`<div class="note">${section.text}</div>`;
    const head = html`<mc-section-header
      class="head"
      .label=${section.title}
      .size=${19}
      .rule=${true}
    ></mc-section-header>`;
    if (section.kind === "faces") {
      return html`${head}
        <div class="faces">
          ${section.tiles.map((tile) => this.#face(tile, section.tileWidth, section.tileHeight, gap))}
        </div>`;
    }
    const cellWidth = Math.floor((contentWidth - 8) / Math.max(1, columns)) - 8;
    return html`${head}
      <div class="cards">
        ${repeat(
          section.cells,
          (cell) => cell.id,
          (cell) => this.#cell(cell, cellWidth, cellHeight),
        )}
      </div>`;
  }

  override render() {
    const { sections, contentWidth } = this.model;
    return html`<div class="scroller" style=${`width:${contentWidth + SCROLL_GUTTER}px`}>
      <div style=${`width:${contentWidth}px`}>
        ${sections.length === 0 ? html`<mc-empty-state .message=${""}></mc-empty-state>` : nothing}
        ${sections.map((section) => this.#section(section))}
      </div>
    </div>`;
  }
}
