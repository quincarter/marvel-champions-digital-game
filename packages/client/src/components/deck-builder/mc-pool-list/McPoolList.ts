import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles, type McWindowedList, type ViewportBox } from "@mc/ui";
import { poolGridGeometry } from "../../../view/deck-pool-grid.js";
import { hit } from "../../../tokens.js";
import { BuilderElement } from "../shared/BuilderElement.js";
import "../mc-pool-cell/mc-pool-cell.js";
import "../mc-pool-row/mc-pool-row.js";
import { McPoolListStyles } from "./mc-pool-list.styles.js";
import type { PoolGridMeasures, PoolListModel } from "./mc-pool-list.types.js";

/** Card view's column cap: enough that a 4K window's pool keeps cards near their usual size instead of blowing up. */
export const POOL_MAX_COLUMNS = 20;
/** The copy strip under each Card view cell. */
export const POOL_GRID_CONTROLS_HEIGHT = hit.target + 8;
const GRID_GAP = 12;
const CAPTION_HEIGHT = 46;
const DESKTOP_CAPTION_HEIGHT = 58;

/** Card view's columns and row height for a list `width` px wide holding `count` cards. */
export function gridMeasuresFor(width: number, count: number, cardScale: number, desktop: boolean): PoolGridMeasures {
  const geometry = poolGridGeometry(width, count, desktop, cardScale, POOL_MAX_COLUMNS);
  return {
    columns: geometry.columns,
    rowHeight: geometry.cellHeight + POOL_GRID_CONTROLS_HEIGHT,
    gap: GRID_GAP,
    captionHeight: desktop ? DESKTOP_CAPTION_HEIGHT : CAPTION_HEIGHT,
  };
}

/**
 * # Pool list
 * The card pool as one native scroller of cards (Card view, a grid of pictures each with its own - and +) or rows (List
 * view), windowed: only the cards near the viewport are built, so a pool of thousands costs what a screen of them does. The
 * columns follow the list's own width (the same arithmetic the Decks screen's pool uses), so the layout is CSS and the
 * scene never lays a card out.
 *
 * Every card keeps its place whether or not it is built: `rectOfIndex` says where card `index` is (a focus stop for a card
 * scrolled away) and `scrollToIndex` brings it into view. `mc-window` (from the list) says the built cards changed.
 *
 * @element mc-pool-list
 * @prop model - The pool (`PoolListModel`).
 * @prop width - The list's width in px; measured from the element, settable where there is no layout (a test).
 * @fires mc-deck-builder - From its cells and rows: `open`, `add`, `remove`.
 * @fires mc-window - The window moved (`WindowDetail`).
 */
export class McPoolList extends BuilderElement {
  static override styles = [ThemeStyles, McPoolListStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    view: { type: String, reflect: true },
    width: { state: true },
  };

  declare model: PoolListModel | null;
  declare view: string;
  declare width: number;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.model = null;
    this.view = "grid";
    this.width = 0;
  }

  /** The windowed list: the pool's native scroller (what the pad's stick and paging move). */
  get scroller(): McWindowedList | null {
    return this.renderRoot.querySelector<McWindowedList>("mc-windowed-list");
  }

  rectOfIndex(index: number): ViewportBox | null {
    return this.scroller?.rectOfIndex(index) ?? null;
  }

  scrollToIndex(index: number): void {
    this.scroller?.scrollToIndex(index);
  }

  resetScroll(): void {
    this.scroller?.resetScroll();
  }

  protected override willUpdate(): void {
    this.view = this.model?.view ?? "grid";
  }

  protected override firstUpdated(): void {
    const list = this.scroller;
    if (!list || typeof ResizeObserver === "undefined") return;
    this.#resize = new ResizeObserver(() => {
      this.width = list.clientWidth;
    });
    this.#resize.observe(list);
    this.width = list.clientWidth;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  #item = (index: number) => {
    const model = this.model!;
    const card = model.cardAt(index);
    return model.view === "grid"
      ? html`<mc-pool-cell .model=${card}></mc-pool-cell>`
      : html`<mc-pool-row .model=${card} .thumbWidth=${model.thumbWidth}></mc-pool-row>`;
  };

  override render() {
    const model = this.model;
    if (!model) return nothing;
    if (model.empty !== null || model.count === 0)
      return html`<div class="empty" data-key="pool-empty">${model.empty ?? ""}</div>`;
    const grid =
      model.view === "grid" ? gridMeasuresFor(this.width || 600, model.count, model.cardScale, model.desktop) : null;
    return html`<mc-windowed-list
      style=${styleMap({ "--caption": `${grid?.captionHeight ?? CAPTION_HEIGHT}px` })}
      .count=${model.count}
      .rowHeight=${grid?.rowHeight ?? model.rowHeight}
      .columns=${grid?.columns ?? 1}
      .columnGap=${grid?.gap ?? 0}
      .renderItem=${this.#item}
    ></mc-windowed-list>`;
  }
}
