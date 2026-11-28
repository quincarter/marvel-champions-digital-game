import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { t } from "../../../i18n/translate.js";
import type { SetupMode } from "./setup-events.types.js";
import type { SetTileInput } from "./setup-set.types.js";
import { CardFrameStyles, SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup set tile
 * One candidate modular set. Wide: a white tile with the set's picture at the left, its name, its count line and a
 * "Cards" tab at the foot; chosen = a red border, a set the scenario may not use is faded with its reason where the count
 * goes. Phone: a checkbox row with the picture at its end. The tile toggles the set; its picture and its tab open the
 * set's cards (areas laid over it, not children of it), and a hold or Inspect does too.
 *
 * @element mc-setup-set-tile
 * @prop tile - What it shows (`SetTileInput`).
 * @attr mode - wide | tablet | phone.
 * @fires mc-setup - `modular-toggle` on a tap, `modular-cards` on the picture, the tab or a hold.
 */
export class McSetupSetTile extends LitElement {
  static override styles = [
    SetupBaseStyles,
    CardFrameStyles,
    css`
      :host {
        display: block;
        position: relative;
        min-height: var(--tile-height, 58px);
      }
      mc-setup-card,
      mc-setup-check-row {
        height: 100%;
      }
      .copy {
        padding-left: var(--pic-room, 40px);
        min-height: 40px;
      }
      .copy .name {
        --name-size: 15px;
      }
      .copy .label {
        margin-top: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .pic {
        position: absolute;
        left: 6px;
        top: 5px;
        bottom: 5px;
        aspect-ratio: 5 / 7;
        pointer-events: none;
        z-index: 1;
      }
      .pic mc-picture-tile {
        display: block;
        width: 100%;
        height: 100%;
      }
      .over {
        left: 0;
        top: 0;
        bottom: 0;
        width: calc(var(--pic-room, 40px) + 4px);
      }
      .tab {
        right: 4px;
        bottom: 4px;
        padding: 2px 4px;
      }
      :host([mode="phone"]) .pic {
        left: auto;
        right: 22px;
        top: 4px;
        bottom: 20px;
      }
      :host([mode="phone"]) .over {
        left: auto;
        right: 0;
        width: calc(100% - var(--over-from, 70%));
        top: 0;
        bottom: 0;
      }
      :host([mode="phone"]) .tab {
        right: 8px;
        bottom: 3px;
        padding: 0;
      }
      .dimmed .pic {
        opacity: 0.6;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    tile: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare tile: SetTileInput | null;
  declare mode: SetupMode;

  constructor() {
    super();
    this.tile = null;
    this.mode = "wide";
  }

  override render() {
    const tile = this.tile;
    if (!tile) return nothing;
    const phone = this.mode === "phone";
    const id = tile.id;
    const cards = tile.picture ? ({ type: "modular-cards", id } as const) : null;
    const picture = tile.picture
      ? html`<div
          class="pic"
          data-hover-card=${tile.picture.cardId}
          data-hover-face=${ifDefined(tile.picture.face ? JSON.stringify(tile.picture.face) : undefined)}
        >
          <mc-picture-tile .picture=${tile.picture.source} frame="1.5" ground="parchment"></mc-picture-tile>
        </div>`
      : nothing;
    const hits = tile.picture
      ? html`<mc-setup-hit class="over" .action=${cards}></mc-setup-hit>
          <mc-setup-chip link class="tab" style="position:absolute;z-index:1" label=${t("tableSetup.cardsTab")} .action=${cards}></mc-setup-chip>`
      : nothing;
    if (phone) {
      return html`<mc-setup-check-row
          stop=${`modular:${id}`}
          name=${tile.name}
          meta=${tile.label}
          ?checked=${tile.selected}
          .action=${tile.barred ? null : ({ type: "modular-toggle", id } as const)}
          .inspectAction=${cards}
        ></mc-setup-check-row
        >${picture}${hits}`;
    }
    return html`<mc-setup-card
        stop=${`modular:${id}`}
        ?selected=${tile.selected}
        ?dim=${tile.dim}
        .action=${tile.barred ? null : ({ type: "modular-toggle", id } as const)}
        .inspectAction=${cards}
      >
        <div class="copy" style=${tile.picture ? "" : "--pic-room:0px"}>
          <div class="name">${tile.name}</div>
          <div class="label">${tile.label}</div>
        </div>
      </mc-setup-card>
      <div class=${tile.dim ? "dimmed" : ""}>${picture}</div>
      ${hits}`;
  }
}
