import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { FilterChip, FilterSort } from "../../shared/filter.types.js";
import "../mc-button/mc-button.js";
import "../mc-filter-chip/mc-filter-chip.js";
import { McFilterBarStyles } from "./mc-filter-bar.styles.js";

/**
 * # Filter bar
 * A row of `mc-filter-chip`s with an optional sort selector and an optional button that opens a filter sheet. Two
 * layouts from one component: a wrapping one (chips as wide as their words, no row limit: the default) and a packed one
 * (chips at the widths the client measured, wrapped into at most `rows` rows of `row-height`; what does not fit is left
 * out and the search box still finds it). Presentational: the client holds the filter and the sort, and answers each
 * event with new properties. Pressed only by a tap.
 *
 * @element mc-filter-bar
 * @prop chips - The chips, in order (`FilterChip`).
 * @prop sort - A sort selector (`FilterSort`); none when absent.
 * @attr sheet-label - The filter sheet button word; no button when empty.
 * @attr prefix - Put before a chip id in its `data-key` and in the reported key ("chip:").
 * @attr rows - The most rows shown; 0 wraps without a limit.
 * @attr row-height - A row height in px; 0 lets a chip be as tall as its own minimum.
 * @attr gap - The space between chips and rows in px (8).
 * @attr rail - One row that scrolls sideways instead of wrapping (a phone's chip strip).
 * @fires mc-activate - A tap on a chip: `detail.key` is `prefix + id`, `detail.id` the chip id.
 * @fires mc-info - A tap on a chip's info segment (`FilterChip.info`): `detail.key` is `prefix + id`, `detail.id` the chip id.
 * @fires mc-sort - `detail.value`: another sort was chosen.
 * @fires mc-filter-sheet - The filter sheet button was tapped.
 */
/** A split chip's info segment: a full touch target. */
const INFO_WIDTH = 44;

export class McFilterBar extends LitElement {
  static override styles = [ThemeStyles, McFilterBarStyles];

  static override properties: PropertyDeclarations = {
    chips: { attribute: false },
    sort: { attribute: false },
    sheetLabel: { type: String, attribute: "sheet-label" },
    prefix: { type: String },
    rows: { type: Number },
    rowHeight: { type: Number, attribute: "row-height" },
    gap: { type: Number },
    rail: { type: Boolean, reflect: true },
  };

  declare chips: readonly FilterChip[];
  declare sort: FilterSort | undefined;
  declare sheetLabel: string;
  declare prefix: string;
  declare rows: number;
  declare rowHeight: number;
  declare gap: number;
  declare rail: boolean;

  constructor() {
    super();
    this.chips = [];
    this.sort = undefined;
    this.sheetLabel = "";
    this.prefix = "chip:";
    this.rows = 0;
    this.rowHeight = 0;
    this.gap = 8;
    this.rail = false;
  }

  /** The element that scrolls sideways (a `rail` bar), for a focus stop that must bring a chip into view. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".bar");
  }

  /** The element drawn for a key (a chip), for a screen focus stops. A chip the row limit cut off is not there to focus. */
  elementOf(key: string): HTMLElement | null {
    const found = this.renderRoot.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    return found && !found.hasAttribute("clipped") ? found : null;
  }

  /** Marks the chips that fall past the last allowed row: hidden from the eye and the focus ring both. */
  #resize: ResizeObserver | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // The bar's width changes which chips fall past the last row.
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => this.#markClipped());
      this.#resize.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  override async updated(): Promise<void> {
    this.#markClipped();
    // The chips lay themselves out after they render: look again once they have.
    await Promise.all(
      [...this.renderRoot.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>(".chip")].map(
        (c) => c.updateComplete,
      ),
    );
    this.#markClipped();
  }

  #markClipped(): void {
    const bar = this.renderRoot.querySelector<HTMLElement>(".bar");
    if (!bar) return;
    const limited = this.rows > 0 && this.rowHeight > 0;
    const bottom = bar.getBoundingClientRect().top + bar.clientHeight;
    for (const chip of bar.querySelectorAll<HTMLElement>(".chip")) {
      const cut = limited && chip.getBoundingClientRect().bottom > bottom + 0.5;
      chip.toggleAttribute("clipped", cut);
      if (cut) chip.style.visibility = "hidden";
      else if (chip.style.visibility) chip.style.visibility = "";
    }
  }

  #emit(name: string, detail: object = {}): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  override render() {
    const { rowHeight, gap, rows, sort } = this;
    const limit = rows > 0 && rowHeight > 0 ? `;max-height:${rows * rowHeight + (rows - 1) * gap}px` : "";
    const cell = rowHeight > 0 ? `height:${rowHeight}px` : "min-height:44px";
    return html`<div class=${this.rail ? "bar rail" : "bar"} role="group" style=${`gap:${gap}px${limit}`}>
      ${repeat(
        this.chips,
        (chip) => chip.id,
        (chip) => {
          const key = this.prefix + chip.id;
          const main = html`<mc-filter-chip
            class="chip"
            data-key=${key}
            style=${`${chip.width !== undefined ? `width:${chip.width}px;` : ""}${cell}`}
            .label=${chip.label}
            .count=${chip.count}
            .value=${key}
            .mark=${chip.mark ?? true}
            .tint=${chip.tint}
            ?selected=${chip.selected}
            ?disabled=${chip.disabled !== undefined && chip.disabled !== false}
            .reason=${typeof chip.disabled === "string" ? chip.disabled : ""}
            @mc-activate=${(event: Event) => {
              event.stopPropagation();
              this.#emit("mc-activate", { key, id: chip.id });
            }}
          ></mc-filter-chip>`;
          const info = chip.info;
          if (!info) return main;
          // A split chip: the filter and, beside it, the "i" button of its own (a tap on it opens the tip, never filters).
          return html`<span class="split"
            >${main}<mc-button
              class="info"
              data-key=${`${key}:info`}
              style=${`${cell};width:${INFO_WIDTH}px${chip.tint ? `;--mc-tint-fill:color-mix(in srgb, ${chip.tint.fill} 78%, black);--mc-tint-ink:${chip.tint.ink}` : ""}`}
              kind="secondary"
              label="i"
              aria-label=${info.label}
              ?selected=${info.open}
              @mc-press=${(event: Event) => {
                event.stopPropagation();
                this.#emit("mc-info", { key, id: chip.id });
              }}
            ></mc-button
          ></span>`;
        },
      )}
      ${
        this.sheetLabel
          ? html`<mc-button
              class="sheet"
              kind="secondary"
              data-key="filter-sheet"
              style=${cell}
              .label=${this.sheetLabel}
              @mc-press=${(event: Event) => {
                event.stopPropagation();
                this.#emit("mc-filter-sheet");
              }}
            ></mc-button>`
          : nothing
      }
      ${
        sort
          ? html`<label class="sort"
              >${sort.label}
              <select
                .value=${sort.value}
                @change=${(event: Event) => this.#emit("mc-sort", { value: (event.target as HTMLSelectElement).value })}
              >
                ${sort.options.map(
                  (option) =>
                    html`<option value=${option.value} ?selected=${option.value === sort.value}>
                      ${option.label}
                    </option>`,
                )}
              </select></label
            >`
          : nothing
      }
    </div>`;
  }
}
