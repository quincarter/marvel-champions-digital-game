import { html, nothing, svg, type PropertyDeclarations, type PropertyValues } from "lit";
import type { McSearchDetail } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import "../mc-seats-buttons/mc-seats-buttons.js";
import "../mc-seats-chips/mc-seats-chips.js";
import type { McSeatsChips } from "../mc-seats-chips/McSeatsChips.js";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatsFiltersModel } from "../seats.types.js";
import { McSeatsFiltersStyles } from "./mc-seats-filters.styles.js";

/** The magnifier on the search toggle, in the button's own ink. */
const LOUPE = svg`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.5" />
  <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" stroke-width="3" />
</svg>`;

/** The lesson link's stop (the key the aspect tip's link has always had). */
export const TIP_LINK_STOP = "aspect-tip-link";

/**
 * # Seats filters
 * The filters row of Take your seats, over the hero roster: the search field, the quick-filter chips, and the buttons
 * (Random, the hero art switch, Use preconstructed). On a narrow screen the field hides behind a magnifier toggle and the
 * chips behind a Filters button; the model says which are shown, and its words arrive translated. While an aspect chip's
 * tip is open it is drawn over everything (`mc-tip-plate`) and a tap anywhere else shuts it without pressing what is
 * beneath. This element holds no state: every press is an event and the scene answers with a new `model`.
 *
 * Focus stops: `hero-search-toggle`, `filters-toggle`, `hero-search`, `hero-chip:<id>`, `hero-chip-info:<aspect>`,
 * `hero-random`, `hero-art`, `preconstructed`, and the open tip's link `aspect-tip-link`.
 *
 * @element mc-seats-filters
 * @prop model - The row (`SeatsFiltersModel`).
 * @fires mc-seats - `search`, `toggle`, `chip`, `chip-info`, `tip-link` or `action` (`seats.types.ts`).
 * @fires mc-search-focus - Bubbles from the search field: whether the caret is in it (the route stands aside while it is).
 */
export class McSeatsFilters extends SeatsElement {
  static override styles = [McSeatsFiltersStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    anchor: { state: true },
  };

  declare model: SeatsFiltersModel | null;
  /** The open tip's "i" segment, found once its chip has drawn. */
  declare anchor: HTMLElement | null;

  constructor() {
    super();
    this.model = null;
    this.anchor = null;
  }

  protected override act(action: string): void {
    if (action === "search-toggle") this.emit({ type: "toggle", what: "search" });
  }

  protected override updated(changed?: PropertyValues): void {
    super.updated();
    if (!changed || changed.has("model")) void this.#findAnchor();
  }

  /** The tip points at its chip's "i", which draws after this element does: wait for it, and drop an answer gone stale. */
  async #findAnchor(): Promise<void> {
    const id = this.model?.tipChipId ?? null;
    const chips = this.renderRoot.querySelector<McSeatsChips>("mc-seats-chips");
    const found = id && chips ? await chips.infoElementOf(id) : null;
    if ((this.model?.tipChipId ?? null) === id && found !== this.anchor) this.anchor = found;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { searchToggle, filtersButton, search, tip } = model;
    return html`<div class="bar">
        ${
          searchToggle
            ? html`<button
                type="button"
                class="loupe"
                data-action="search-toggle"
                data-stop="hero-search-toggle"
                aria-label=${searchToggle.label}
                aria-pressed=${searchToggle.open ? "true" : "false"}
              >
                ${LOUPE}
              </button>`
            : nothing
        }
        ${
          filtersButton
            ? html`<mc-button
                class="filters"
                kind="secondary"
                data-stop="filters-toggle"
                .label=${filtersButton.label}
                ?selected=${filtersButton.open}
                @mc-press=${(event: Event) => {
                  event.stopPropagation();
                  this.emit({ type: "toggle", what: "filters" });
                }}
              ></mc-button>`
            : nothing
        }
        ${
          search.visible
            ? html`<mc-search-field
                class="search"
                data-stop="hero-search"
                .value=${search.text}
                .placeholder=${search.placeholder}
                .clearLabel=${t("deckPicker.searchClear")}
                .maxLength=${80}
                .debounce=${140}
                escape-clears
                @mc-search=${(event: CustomEvent<McSearchDetail>) => {
                  event.stopPropagation();
                  this.emit({ type: "search", text: event.detail.value });
                }}
              ></mc-search-field>`
            : nothing
        }
        <mc-seats-buttons .buttons=${model.buttons}></mc-seats-buttons>
      </div>
      <mc-seats-chips .chips=${model.chips} ?rail=${model.rail}></mc-seats-chips>
      ${
        tip
          ? html`<mc-tip-plate
              .anchor=${this.anchor}
              .heading=${tip.title}
              .tagline=${tip.tagline}
              .body=${tip.tipLine}
              .linkLabel=${tip.linkLabel}
              .linkReason=${tip.linkReason ?? ""}
              .linkAvailable=${tip.linkAvailable}
              .linkStop=${TIP_LINK_STOP}
              @mc-tip-link=${(event: Event) => {
                event.stopPropagation();
                this.emit({ type: "tip-link" });
              }}
              @mc-tip-close=${(event: Event) => {
                event.stopPropagation();
                if (model.tipChipId) this.emit({ type: "chip-info", id: model.tipChipId });
              }}
            ></mc-tip-plate>`
          : nothing
      }`;
  }
}
