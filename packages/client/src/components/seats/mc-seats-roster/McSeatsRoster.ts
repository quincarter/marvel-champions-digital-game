import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { SeatsElement } from "../SeatsElement.js";
import type { HeroShelfModel, SeatsRosterModel } from "../seats.types.js";
import "../mc-hero-row/mc-hero-row.js";
import "../mc-hero-shelf/mc-hero-shelf.js";
import "../mc-rec-strip/mc-rec-strip.js";
import { McHeroRow } from "../mc-hero-row/McHeroRow.js";
import { McHeroShelf } from "../mc-hero-shelf/McHeroShelf.js";
import { McRecStrip } from "../mc-rec-strip/McRecStrip.js";
import { McSeatsRosterStyles } from "./mc-seats-roster.styles.js";

/** The id of the Recommended shelf, which leads the shelves and is drawn as the strip. */
const RECOMMENDED = "recommended";

/** What `readScroll` hands back to `restoreScroll` on a later visit. */
export interface RosterScroll {
  readonly top: number;
  /** Each shelf's sideways position, by shelf id (only those scrolled). */
  readonly rows: Readonly<Record<string, number>>;
}

/**
 * # Seats roster
 * Take your seats' hero roster, in the one box that scrolls down: the Recommended strip first (when there is someone to
 * recommend), then a shelf per pack, each a sideways row of hero tiles; or, in `grid` mode, one pack's tiles wrapped
 * under a "◂ All packs" button; or, when nothing matches, the empty words with a Clear button. Every press and inspect
 * of a tile, a shelf header or the buttons leaves as the one `mc-seats` event (the parts raise it; this element adds
 * none of its own beyond `drill-back` and `hero-clear`).
 *
 * The roster owns the picture lease's far edge: it passes its scroller to each row, so a row far down the page holds no
 * pictures and a row near its view loads those near it (see `mc-hero-row`).
 *
 * Stops (`data-stop`): `rec-toggle`, `hero-shelf:<pack id>`, `hero:<card id>`, `hero-rec:<card id>`, `drill-back`,
 * `hero-clear`. All text comes in the model.
 *
 * @element mc-seats-roster
 * @prop model - The roster (`SeatsRosterModel`).
 * @fires mc-seats - `{ type: "action", action: "drill-back" | "hero-clear" }` from its own buttons, and the parts' events.
 */
export class McSeatsRoster extends SeatsElement {
  static override styles = [McSeatsRosterStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    scroller: { state: true },
  };

  declare model: SeatsRosterModel | null;
  /** The element that scrolls down, handed to the rows once it exists. */
  declare scroller: HTMLElement | null;

  constructor() {
    super();
    this.model = null;
    this.scroller = null;
  }

  protected override act(action: string): void {
    if (action === "drill-back" || action === "hero-clear") this.emit({ type: "action", action });
  }

  protected override firstUpdated(): void {
    this.scroller = this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  /** The row of a shelf (or the Recommended strip, or the grid) by its id. */
  #rowOf(shelfId: string): McHeroRow | null {
    const part = this.renderRoot.querySelector(`[data-shelf="${CSS.escape(shelfId)}"]`);
    if (part instanceof McHeroRow) return part;
    return part instanceof McHeroShelf || part instanceof McRecStrip ? part.row : null;
  }

  /** Pages a shelf's row as its ‹ › would (LT / RT on a pad); the stop key of the first tile at its start, or null. */
  pageShelf(shelfId: string, direction: 1 | -1): string | null {
    return this.#rowOf(shelfId)?.page(direction) ?? null;
  }

  /** The vertical position and every scrolled row's sideways one, to hand back to `restoreScroll` on a later visit. */
  readScroll(): RosterScroll {
    const rows: Record<string, number> = {};
    for (const part of this.renderRoot.querySelectorAll<HTMLElement>("[data-shelf]")) {
      const left = this.#rowOf(part.dataset.shelf ?? "")?.rowElement?.scrollLeft ?? 0;
      if (left > 0) rows[part.dataset.shelf!] = left;
    }
    return { top: this.scroller?.scrollTop ?? 0, rows };
  }

  restoreScroll(state: RosterScroll): void {
    if (this.scroller) this.scroller.scrollTop = state.top;
    for (const [id, left] of Object.entries(state.rows)) {
      const row = this.#rowOf(id)?.rowElement;
      if (row) row.scrollLeft = left;
    }
  }

  #shelf(shelf: HeroShelfModel, model: SeatsRosterModel) {
    const hint = model.pagingHintShelf === shelf.id ? (model.pagingGlyphs ?? null) : null;
    return shelf.id === RECOMMENDED
      ? html`<mc-rec-strip
          data-shelf=${shelf.id}
          .shelf=${shelf}
          .hint=${hint}
          .scrollRoot=${this.scroller}
          previous-label=${model.previousLabel}
          next-label=${model.nextLabel}
        ></mc-rec-strip>`
      : html`<mc-hero-shelf
          data-shelf=${shelf.id}
          .shelf=${shelf}
          .hint=${hint}
          .scrollRoot=${this.scroller}
          previous-label=${model.previousLabel}
          next-label=${model.nextLabel}
        ></mc-hero-shelf>`;
  }

  #body(model: SeatsRosterModel) {
    if (model.emptyText !== null) {
      return html`<mc-empty-state .message=${model.emptyText}></mc-empty-state> ${
          model.clearLabel
            ? html`<button type="button" class="clear" data-action="hero-clear" data-stop="hero-clear">
                ${model.clearLabel}
              </button>`
            : nothing
        }`;
    }
    if (model.mode === "grid") {
      const shelf = model.shelves[0];
      return html`<mc-hero-row
        data-shelf=${shelf?.id ?? "pack"}
        wrap
        .tiles=${shelf?.tiles ?? []}
        .scrollRoot=${this.scroller}
      >
        <div slot="head" class="grid-head">
          ${
            model.drillBack
              ? html`<button type="button" class="back" data-action="drill-back" data-stop="drill-back">
                  ${model.drillBack}
                </button>`
              : nothing
          }
          ${shelf ? html`<mc-section-header .label=${shelf.title} .count=${shelf.count}></mc-section-header>` : nothing}
        </div>
      </mc-hero-row>`;
    }
    return html`${repeat(
      model.shelves,
      (shelf) => shelf.id,
      (shelf) => this.#shelf(shelf, model),
    )}`;
  }

  override render() {
    const model = this.model;
    return html`<div class="scroller"><div class="stack">${model ? this.#body(model) : nothing}</div></div>`;
  }
}
