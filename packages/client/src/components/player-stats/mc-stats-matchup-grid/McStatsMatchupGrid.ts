import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { onTap } from "@mc/ui";
import { StatsElement } from "../shared/StatsElement.js";
import type { StatsMode } from "../shared/stats-events.types.js";
import "../mc-stats-matchup-head/mc-stats-matchup-head.js";
import { McStatsMatchupGridStyles } from "./mc-stats-matchup-grid.styles.js";
import type {
  McStatsMatchupGridProps,
  StatsGridCursor,
  StatsGridModel,
  StatsGridStep,
} from "./mc-stats-matchup-grid.types.js";

/**
 * # Matchups grid
 * Which villains you have played each hero (or modular set) against, and the hardest way you beat each pairing: a grid of
 * cells (the heat grid's squares or the stamp grid's discs) in a native scroll container with its row and column names
 * pinned. One focus stop, `grid:cell`, for the whole grid: the arrows move its cursor from cell to cell (`step`, which
 * says false at the grid's edge so the arrow leaves it), Page and Home / End jump it, and a tap on a cell moves the cursor
 * there. The line under the grid reads the pairing at the cursor in words, every tier in full, and the key follows.
 *
 * @element mc-stats-matchup-grid
 * @prop grid - The grid (`StatsGridModel`).
 * @prop cursor - The pairing the cursor is on.
 * @attr mode - wide | phone.
 * @fires mc-player-stats - `{ type: "grid-cursor", row, column }` when the cursor moves.
 */
export class McStatsMatchupGrid extends StatsElement implements McStatsMatchupGridProps {
  static override styles = McStatsMatchupGridStyles;

  static override properties: PropertyDeclarations = {
    grid: { attribute: false },
    cursor: { attribute: false },
    mode: { type: String, reflect: true },
    kind: { type: String, reflect: true },
  };

  declare grid: StatsGridModel | null;
  declare cursor: StatsGridCursor;
  declare mode: StatsMode;
  declare kind: "heat" | "stamps";
  #unTap: (() => void) | null = null;

  constructor() {
    super();
    this.grid = null;
    this.cursor = { row: 0, column: 0 };
    this.mode = "wide";
    this.kind = "heat";
  }

  /** The scrolling body: a swipe or the wheel pans it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  /** The cell under the cursor, for the focus ring. */
  get cursorCell(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".cell[data-cursor]");
  }

  /** The line under the grid, as the cursor reads it now. */
  get readout(): { readonly title: string; readonly detail: string } {
    return this.grid ? this.grid.readout(this.cursor.row, this.cursor.column) : { title: "", detail: "" };
  }

  #shape(): { readonly rows: number; readonly columns: number } {
    return { rows: this.grid?.rows.length ?? 0, columns: this.grid?.columns.length ?? 0 };
  }

  #clamp(row: number, column: number): StatsGridCursor {
    const { rows, columns } = this.#shape();
    return {
      row: Math.min(Math.max(0, rows - 1), Math.max(0, row)),
      column: Math.min(Math.max(0, columns - 1), Math.max(0, column)),
    };
  }

  #move(to: StatsGridCursor): void {
    if (to.row === this.cursor.row && to.column === this.cursor.column) return;
    this.cursor = to;
    this.emit({ type: "grid-cursor", row: to.row, column: to.column });
  }

  /** The cursor one cell along; false at the grid's edge, so the arrow then leaves the grid. */
  step(direction: StatsGridStep): boolean {
    const { rows, columns } = this.#shape();
    const row = this.cursor.row + (direction === "down" ? 1 : direction === "up" ? -1 : 0);
    const column = this.cursor.column + (direction === "right" ? 1 : direction === "left" ? -1 : 0);
    if (row < 0 || row >= rows || column < 0 || column >= columns) return false;
    this.#move({ row, column });
    this.#reveal();
    return true;
  }

  /** A page of rows up or down. */
  page(direction: 1 | -1): void {
    const scroller = this.scroller;
    const cell = this.cursorCell?.getBoundingClientRect().height || 40;
    const pageRows = Math.max(1, Math.floor((scroller?.clientHeight ?? 0) / cell) - 1);
    this.#move(this.#clamp(this.cursor.row + direction * pageRows, this.cursor.column));
    this.#reveal();
  }

  /** The first or last row, in the cursor's column. */
  edge(which: "home" | "end"): void {
    this.#move(this.#clamp(which === "home" ? 0 : Number.MAX_SAFE_INTEGER, this.cursor.column));
    this.#reveal();
  }

  /** Scrolls the body the least that shows the whole cursor cell, clear of the pinned names. */
  reveal(): void {
    this.#reveal();
  }

  #reveal(): void {
    void this.updateComplete.then(() => {
      const scroller = this.scroller;
      const cell = this.cursorCell;
      const corner = this.renderRoot.querySelector<HTMLElement>(".corner");
      if (!scroller || !cell || !corner) return;
      const box = scroller.getBoundingClientRect();
      const at = cell.getBoundingClientRect();
      const pinned = corner.getBoundingClientRect();
      const left = box.left + pinned.width;
      const top = box.top + pinned.height;
      if (at.left < left) scroller.scrollLeft -= left - at.left;
      else if (at.right > box.right) scroller.scrollLeft += at.right - box.right;
      if (at.top < top) scroller.scrollTop -= top - at.top;
      else if (at.bottom > box.bottom) scroller.scrollTop += at.bottom - box.bottom;
    });
  }

  protected override firstUpdated(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    // A tap (never the lift that ends a swipe) on a cell puts the cursor there.
    this.#unTap = onTap(scroller, (event) => {
      const cell = event
        .composedPath()
        .find((node): node is HTMLElement => node instanceof HTMLElement && node.dataset.row !== undefined);
      if (cell) this.#move({ row: Number(cell.dataset.row), column: Number(cell.dataset.column) });
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unTap?.();
    this.#unTap = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("grid") && this.grid) this.kind = this.grid.kind;
  }

  protected override updated(): void {
    this.emitRendered();
  }

  override render() {
    const grid = this.grid;
    if (!grid) return nothing;
    const { rows, columns } = this.#shape();
    const readout = this.readout;
    const at = this.cursor;
    return html`<div class="scroller" data-key="grid" data-stop="grid:cell" tabindex="-1">
        <div class="grid" style=${styleMap({ "--rows": String(rows), "--columns": String(columns) })}>
          <div class="corner"></div>
          ${grid.columns.map(
            (column, index) =>
              html`<mc-stats-matchup-head
                axis="column"
                .kind=${grid.kind}
                .entry=${column}
                ?cursor=${index === at.column}
              ></mc-stats-matchup-head>`,
          )}
          ${grid.rows.map(
            (row, r) =>
              html`<mc-stats-matchup-head
                  axis="row"
                  .kind=${grid.kind}
                  .entry=${row}
                  ?cursor=${r === at.row}
                ></mc-stats-matchup-head>
                ${grid.columns.map((_, c) => this.#cell(grid, r, c))}`,
          )}
        </div>
      </div>
      <div class="readout">
        <div class="title">${readout.title}</div>
        <div class="detail">${readout.detail}</div>
      </div>
      <mc-stats-matchup-legend .entries=${grid.legend}></mc-stats-matchup-legend>`;
  }

  #cell(grid: StatsGridModel, row: number, column: number) {
    const index = row * grid.columns.length + column;
    const look = grid.looks[index]!;
    const tier = look === "unplayed" || look === "played" ? undefined : grid.tiers[look];
    const word = grid.words[index];
    const cursor = row === this.cursor.row && column === this.cursor.column;
    return html`<div
      class="cell"
      data-row=${row}
      data-column=${column}
      data-look=${look}
      ?data-cursor=${cursor}
      data-tier=${tier ? look : nothing}
      style=${tier ? styleMap({ "--tier": tier.color, "--ink": tier.ink }) : nothing}
    >
      ${word ? html`<span class="word">${word}</span>` : nothing}
    </div>`;
  }
}
