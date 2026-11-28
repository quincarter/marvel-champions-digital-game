import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { McBriefingOptionTileStyles } from "./mc-briefing-option-tile.styles.js";
import type { OptionTileModel } from "./mc-briefing-option-tile.types.js";

/**
 * # Briefing option tile
 * The tile the role call, the modular-set call and the easier-start toggle share: a framed paper card (`mc-press-card`) with
 * a Bangers name (and aspect chips at its right end), a few words and a label at its foot, all one press. A tile that cannot
 * be picked is dimmed and says why in words (never dimmed alone) and takes no press and no focus stop; one already chosen
 * wears a heal-green stripe and its words; a switched-on tile (the easier start) wears the 4px red frame, and its words say
 * the state too.
 *
 * @element mc-briefing-option-tile
 * @prop tile - `OptionTileModel`.
 * @fires mc-briefing - When the tile action is a `BriefingDetail`.
 * @fires mc-pressed - `PressDetail` whose `action` is the tile action, when it is not (a role step the owner handles).
 */
export class McBriefingOptionTile extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingOptionTileStyles];

  static override properties: PropertyDeclarations = {
    tile: { attribute: false },
  };

  declare tile: OptionTileModel | null;

  constructor() {
    super();
    this.tile = null;
    // A press whose action is a BriefingDetail (an answer, a toggle) leaves as `mc-briefing`; any other action goes up as it is.
    new BriefingRelay(this);
  }

  override render() {
    const tile = this.tile;
    if (!tile) return nothing;
    return html`<mc-press-card
      .stop=${tile.available ? tile.stop : ""}
      .action=${tile.available ? tile.action : null}
      ?dim=${!tile.available && !tile.stripe}
      ?selected=${tile.on === true}
    >
      <div class="tile ${tile.stripe ? "striped" : ""}">
        <div class="head">
          <span class="name display">${tile.title}</span>
          ${
            tile.chips && tile.chips.length > 0
              ? html`<span class="chips"
                  >${tile.chips.map(
                    (chip) => html`<mc-aspect-chip aspect=${chip.aspect} label=${chip.label}></mc-aspect-chip>`,
                  )}</span
                >`
              : nothing
          }
        </div>
        <span class=${tile.bodyWarn ? "words label red" : "words body"}>${tile.body}</span>
        ${tile.footer ? html`<span class="foot label ${tile.footerTone ?? ""}">${tile.footer}</span>` : nothing}
      </div>
    </mc-press-card>`;
  }
}
