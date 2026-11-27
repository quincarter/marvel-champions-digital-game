import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-bar-chart/mc-bar-chart.js";
import "../mc-button/mc-button.js";
import "../mc-action-bar/mc-action-bar.js";
import "../mc-line-list/mc-line-list.js";
import "../mc-picture-tile/mc-picture-tile.js";
import "../mc-section-header/mc-section-header.js";
import "../mc-stat-tiles/mc-stat-tiles.js";
import type { McLineList } from "../mc-line-list/McLineList.js";
import { SCROLL_GUTTER } from "../mc-sheet/McSheet.js";
import { fitTextWithin } from "../../shared/fit-text.js";
import type { DeckDetailsAction, DeckDetailsModel } from "./mc-deck-details.types.js";

/** The footer: padding, the primary action, a gap, the second row, padding. */
const FOOTER = 14 + 52 + 8 + 44 + 14;

const styles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--mc-fill-paper);
    box-shadow: inset 0 0 0 3px var(--mc-line-ink);
  }
  .body {
    position: absolute;
    left: 14px;
    top: 14px;
    bottom: ${FOOTER + 7}px;
  }
  mc-picture-tile {
    display: block;
    margin-bottom: 10px;
  }
  .title {
    font-size: 20px;
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
    padding-bottom: 2px;
  }
  .who,
  .counts {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-bottom: 2px;
  }
  .who {
    font-size: 14px;
    line-height: 1.2;
    opacity: 0.75;
  }
  .counts {
    font-size: var(--mc-small-12, 12px);
    line-height: 1.2;
    opacity: 0.75;
  }
  .status {
    font-size: var(--mc-small-12, 12px);
    font-weight: 700;
    line-height: 1.2;
    padding-bottom: 2px;
  }
  .missing {
    font-size: var(--mc-small-12, 12px);
    line-height: 1.2;
    opacity: 0.75;
    padding-bottom: 2px;
  }
  .gap {
    height: 10px;
  }
  mc-section-header {
    height: 16px;
  }
  mc-bar-chart {
    margin-bottom: 10px;
  }
  mc-stat-tiles {
    margin-bottom: -4px;
  }
  .end {
    height: 6px;
  }
  mc-action-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: ${FOOTER}px;
  }
  mc-button {
    --mc-button-size: 13px;
    height: 44px;
  }
  mc-button[data-wide] {
    height: 52px;
  }
`;

/**
 * # Deck details
 * One deck's panel: a framed body that scrolls (the hero's picture, its names and standing in words, a cost chart,
 * boxed counts and the cards by group) over a footer of "Use this deck", "Edit deck" and "Close". Built from
 * `mc-picture-tile`, `mc-section-header`, `mc-bar-chart`, `mc-stat-tiles`, `mc-line-list`, `mc-action-bar` and `mc-button`.
 * The panel's size is its parent's. The three buttons raise `mc-activate` with `panel:use`, `panel:edit` and
 * `panel:close` (a dimmed one still does, so the screen can say why); `elementOf` finds each, and the body, for the
 * focus ring; `hoverFaces()` gives the hero picture and every card line for a card hover popover.
 *
 * @element mc-deck-details
 * @fires mc-activate - `detail.key`.
 */
export class McDeckDetails extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DeckDetailsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The element that scrolls. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".body");
  }

  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  /** The hero picture and each card line, with their cards: where a hover popover is wanted. */
  hoverFaces(): { readonly cardId: string; readonly element: HTMLElement }[] {
    const model = this.model;
    const art = this.renderRoot.querySelector<HTMLElement>("mc-picture-tile");
    const faces: { cardId: string; element: HTMLElement }[] = [];
    if (model && art) faces.push({ cardId: model.cardId, element: art });
    const lines = this.renderRoot.querySelector<McLineList>("mc-line-list");
    if (lines) faces.push(...lines.hoverEntries());
    return faces;
  }

  override updated(): void {
    fitTextWithin(this.renderRoot);
  }

  #button(key: string, action: DeckDetailsAction, wide = false) {
    return html`<mc-button
      data-key=${key}
      ?data-wide=${wide}
      kind=${action.look}
      .label=${action.label}
      ?disabled=${action.disabled !== undefined}
      ?pressable=${action.disabled !== undefined}
      .reason=${typeof action.disabled === "string" ? action.disabled : ""}
      @mc-press=${(event: Event) => {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
      }}
    ></mc-button>`;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="body scroller" style=${`width:${m.contentWidth + SCROLL_GUTTER}px`}>
        <div style=${`width:${m.contentWidth}px`}>
          <mc-picture-tile .picture=${m.picture} style=${`height:${m.artHeight}px`}></mc-picture-tile>
          <div class="title">${m.title}</div>
          <div class="who" data-fit>${m.who}</div>
          <div class="counts" data-fit>${m.counts}</div>
          ${m.status ? html`<div class="status">${m.status}</div>` : nothing}
          ${m.missing ? html`<div class="missing">${m.missing}</div>` : nothing}
          <div class="gap"></div>
          <mc-section-header level="caption" .rule=${false} .label=${m.statsHeading}></mc-section-header>
          <mc-bar-chart .bars=${m.bars}></mc-bar-chart>
          <mc-stat-tiles .rows=${m.tileRows}></mc-stat-tiles>
          <div class="end"></div>
          <mc-section-header level="caption" .rule=${false} .label=${m.cardsHeading}></mc-section-header>
          <mc-line-list .groups=${m.groups}></mc-line-list>
          <div class="end"></div>
        </div>
      </div>
      <mc-action-bar>
        ${this.#button("panel:use", m.use, true)} ${m.edit ? this.#button("panel:edit", m.edit) : nothing}
        ${this.#button("panel:close", m.close, m.edit === null)}
      </mc-action-bar>`;
  }
}
