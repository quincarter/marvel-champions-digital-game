import { watchCard } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import type { SetTileInput } from "./mc-setup-set-tile.types.js";
import { McSetupSetTileStyles } from "./mc-setup-set-tile.styles.js";

/**
 * # Setup set tile
 * One candidate modular set. Wide: a white tile with the set's picture at the left, its name, its count line and a
 * "Cards" tab at the foot; chosen = a red border, a set the scenario may not use is faded with its reason where the count
 * goes. Phone: a checkbox row with the picture at its end. The tile toggles the set; its picture and its tab open the
 * set's cards (areas laid over it, not children of it), and a hold or Inspect does too. A mouse over the picture raises
 * the card hover (`watchCard`), and a hold on it Inspects the card.
 *
 * @element mc-setup-set-tile
 * @prop tile - What it shows (`SetTileInput`).
 * @attr mode - wide | phone.
 * @fires mc-setup - `modular-toggle` on a tap, `modular-cards` on the picture, the tab or a hold.
 */
export class McSetupSetTile extends LitElement {
  static override styles = McSetupSetTileStyles;

  static override properties: PropertyDeclarations = {
    tile: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare tile: SetTileInput | null;
  declare mode: SetupMode;
  #watched: HTMLElement | null = null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.tile = null;
    this.mode = "wide";
    new SetupRelay(this);
  }

  /** The picture's hit area is the card picture the popover follows. */
  protected override updated(): void {
    const area = this.renderRoot.querySelector<HTMLElement>(".over");
    if (area === this.#watched) return;
    this.#unwatch?.();
    this.#watched = area;
    this.#unwatch = area
      ? watchCard(area, () => {
          const picture = this.tile?.picture;
          return picture ? { cardId: picture.cardId, ...(picture.face ? { face: picture.face } : {}) } : null;
        })
      : null;
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = null;
    this.#watched = null;
    super.disconnectedCallback();
  }

  override render() {
    const tile = this.tile;
    if (!tile) return nothing;
    const phone = this.mode === "phone";
    const id = tile.id;
    const cards = tile.picture ? ({ type: "modular-cards", id } as const) : null;
    const toggle = tile.barred ? null : ({ type: "modular-toggle", id } as const);
    const picture = tile.picture
      ? html`<div class="pic">
          <mc-picture-tile .picture=${tile.picture.source} frame="1.5" ground="parchment"></mc-picture-tile>
        </div>`
      : nothing;
    const hits = tile.picture
      ? html`<mc-hit-area class="over" .action=${cards}></mc-hit-area>
          <mc-chip link class="tab" label=${t("tableSetup.cardsTab")} .action=${cards}></mc-chip>`
      : nothing;
    if (phone) {
      return html`<mc-check-row
          .stop=${`modular:${id}`}
          name=${tile.name}
          meta=${tile.label}
          ?checked=${tile.selected}
          .action=${toggle}
          .holdAction=${cards}
        ></mc-check-row
        >${picture}${hits}`;
    }
    return html`<mc-press-card
        .stop=${`modular:${id}`}
        ?selected=${tile.selected}
        ?dim=${tile.dim}
        .action=${toggle}
        .holdAction=${cards}
      >
        <div class="copy" style=${tile.picture ? "" : "--pic-room:0px"}>
          <div class="name">${tile.name}</div>
          <div class="label">${tile.label}</div>
        </div>
      </mc-press-card>
      <div class=${tile.dim ? "dimmed" : ""}>${picture}</div>
      ${hits}`;
  }
}
