import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { watchCard } from "@mc/ui";
import { McStatsMatchupHeadStyles } from "./mc-stats-matchup-head.styles.js";
import type { McStatsMatchupHeadProps, StatsGridAxisModel } from "./mc-stats-matchup-head.types.js";

/**
 * # Matchups grid header
 * A row's or a column's name on the heat or stamp grid. The stamp grid leads with the picture (a mouse over it opens the
 * card popover); the heat grid has the name alone, a column's standing on end. The name keeps a custom pack's credit in
 * sight. The header of the cursor's row and column is tinted.
 *
 * @element mc-stats-matchup-head
 * @prop entry - The name, picture and card (`StatsGridAxisModel`).
 * @attr axis - row | column.
 * @attr kind - heat | stamps.
 * @attr cursor - The cursor is here.
 */
export class McStatsMatchupHead extends LitElement implements McStatsMatchupHeadProps {
  static override styles = McStatsMatchupHeadStyles;

  static override properties: PropertyDeclarations = {
    axis: { type: String, reflect: true },
    kind: { type: String, reflect: true },
    entry: { attribute: false },
    cursor: { type: Boolean, reflect: true },
  };

  declare axis: "row" | "column";
  declare kind: "heat" | "stamps";
  declare entry: StatsGridAxisModel | null;
  declare cursor: boolean;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.axis = "row";
    this.kind = "heat";
    this.entry = null;
    this.cursor = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override updated(): void {
    const picture = this.renderRoot.querySelector<HTMLElement>("mc-picture-tile");
    if (!picture || this.#unwatch) return;
    this.#unwatch = watchCard(picture, () => (this.entry?.cardId ? { cardId: this.entry.cardId } : null));
  }

  override render() {
    const entry = this.entry;
    if (!entry) return nothing;
    const stamps = this.kind === "stamps";
    return html`${
        stamps
          ? html`<mc-picture-tile
              data-card-id=${entry.cardId ?? ""}
              .picture=${entry.picture ?? { src: null }}
              ground="parchment"
              .frame=${0}
            ></mc-picture-tile>`
          : nothing
      }
      <mc-stats-credited
        class="name"
        label=${entry.name}
        .lines=${stamps ? 2 : 1}
        title=${entry.name}
      ></mc-stats-credited>`;
  }
}
